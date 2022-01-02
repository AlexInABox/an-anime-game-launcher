import type { VoicePack } from './types/GameData';
import type { VoiceInfo, InstalledVoiceInfo, VoiceLang } from './types/Voice';

import constants from './Constants';
import Game from './Game';
import AbstractInstaller from './core/AbstractInstaller';
import Configs from './Configs';
import Debug, { DebugThread } from './core/Debug';
import Downloader, { Stream as DownloadingStream } from './core/Downloader';

declare const Neutralino;

class Stream extends AbstractInstaller
{
    public constructor(uri: string, predownloaded: boolean = false)
    {
        super(uri, constants.paths.gameDir, predownloaded);
    }
}

export default class Voice
{
    /**
     * Get current installed voice data info
     */
    public static get current(): Promise<VoiceInfo>
    {
        return new Promise(async (resolve) => {
            const persistentPath = `${await constants.paths.gameDataDir}/Persistent/audio_lang_14`;
            const voiceDir = await constants.paths.voiceDir;

            const langs = {
                'English(US)': 'en-us',
                'Japanese': 'ja-jp',
                'Korean': 'ko-kr',
                'Chinese': 'zn-cn'
            };

            let installedVoice: VoiceInfo = {
                installed: [],
                active: null
            };
            
            // Parse installed voice packages
            Neutralino.filesystem.readDirectory(voiceDir)
                .then(async (files) => {
                    files = files.filter((file) => file.type == 'DIRECTORY')
                        .map((file) => file.entry);

                    for (const folder of Object.keys(langs))
                        if (files.includes(folder))
                        {
                            const voiceFiles: { entry: string, type: string }[] = await Neutralino.filesystem.readDirectory(`${voiceDir}/${folder}`);

                            const latestVoiceFile = voiceFiles.sort((a, b) => a.entry < b.entry ? -1 : 1).pop();

                            installedVoice.installed.push({
                                lang: langs[folder],
                                version: latestVoiceFile ? `${/_([\d]*\.[\d]*)_/.exec(latestVoiceFile.entry)![1]}.0` : null
                            } as InstalledVoiceInfo);
                        }

                    parseActiveVoice();
                })
                .catch(() => parseActiveVoice());

            // Parse active voice package
            const parseActiveVoice = () => {
                Neutralino.filesystem.readFile(persistentPath)
                    .then(async (lang) => {
                        const voiceFiles: { entry: string, type: string }[] = await Neutralino.filesystem.readDirectory(`${voiceDir}/${lang}`);

                        const latestVoiceFile = voiceFiles.sort((a, b) => a.entry < b.entry ? -1 : 1).pop();
                        
                        installedVoice.active = {
                            lang: langs[lang] ?? null,
                            version: latestVoiceFile ? `${/_([\d]*\.[\d]*)_/.exec(latestVoiceFile.entry)![1]}.0` : null
                        } as InstalledVoiceInfo;

                        Debug.log({
                            function: 'Voice.current',
                            message: {
                                'active voice': `${installedVoice.active.lang} (${installedVoice.active.version})`,
                                'installed voices': installedVoice.installed.map((voice) => `${voice.lang} (${voice.version})`).join(', ')
                            }
                        });

                        resolve(installedVoice);
                    })
                    .catch(() => resolve(installedVoice));
            };
        });
    }

    /**
     * Get currently selected voice package language according to the config file
     */
    public static get selected(): Promise<VoiceLang>
    {
        return Configs.get('lang.voice') as Promise<VoiceLang>;
    }

    /**
     * Get latest voice data info
     * 
     * @returns Latest Voice Pack information else throws Error if company's servers are unreachable or if they responded with an error
     */
    public static get latest(): Promise<VoicePack[]>
    {
        return new Promise((resolve, reject) => {
            Game.getLatestData()
                .then((data) => resolve(data.game.latest.voice_packs))
                .catch((error) => reject(error));
        });
    }

    /**
     * Get updated voice data from the specified version to the latest
     * 
     * @returns null if the difference can't be calculated
     * @returns Error object if company's servers are unreachable or they responded with an error
     */
    public static getDiff(version: string): Promise<VoicePack[]|null>
    {
        return new Promise((resolve, reject) => {
            Game.getDiff(version)
                .then((data) => resolve(data?.voice_packs ?? null))
                .catch((error) => reject(error));
        });
    }

    /**
     * Get the voice data installation stream
     * 
     * @returns null if the language or the version can't be found
     * @returns rejects Error object if company's servers are unreachable or they responded with an error
     */
    public static update(lang: string, version: string|null = null): Promise<Stream|null>
    {
        Debug.log({
            function: 'Voice.update',
            message: version !== null ?
                `Updating the voice package from the ${version} version` :
                'Installing the voice package'
        });

        return new Promise((resolve, reject) => {
            this.isUpdatePredownloaded(lang).then(async (predownloaded) => {
                if (predownloaded)
                {
                    Debug.log({
                        function: 'Voice.update',
                        message: 'Voice package update is already pre-downloaded. Unpacking started'
                    });

                    resolve(new Stream(`${await constants.paths.launcherDir}/voice-${lang}-predownloaded.zip`, true));
                }

                else
                {
                    (version === null ? this.latest : this.getDiff(version))
                        .then((data: VoicePack[]|null) => {
                            if (data === null)
                                resolve(null);

                            else
                            {
                                const voice = data.filter(voice => voice.language === lang);

                                resolve(voice.length === 1 ? new Stream(voice[0].path) : null);
                            }
                        })
                        .catch((error) => reject(error));
                }
            });
        });
    }

    /**
     * Pre-download the game's voice update
     * 
     * @param version current game version to download difference from
     * 
     * @returns null if the game pre-downloading is not available or the language wasn't found. Otherwise - downloading stream
     * @returns Error if company's servers are unreachable or they responded with an error
     */
    public static predownloadUpdate(lang: string, version: string|null = null): Promise<DownloadingStream|null>
    {
        const debugThread = new DebugThread('Voice.predownloadUpdate', 'Predownloading game voice data...')

        return new Promise((resolve) => {
            Game.getLatestData()
                .then((data) => {
                    if (data.pre_download_game)
                    {
                        let voicePack = data.pre_download_game.latest.voice_packs.filter(voice => voice.language === lang);

                        if (version !== null)
                            for (const diff of data.pre_download_game.diffs)
                                if (diff.version == version)
                                {
                                    voicePack = diff.voice_packs.filter(voice => voice.language === lang);

                                    break;
                                }

                        if (voicePack.length === 1)
                        {
                            debugThread.log(`Downloading update from the path: ${voicePack[0].path}`);

                            constants.paths.launcherDir.then((dir) => {
                                Downloader.download(voicePack[0].path, `${dir}/voice-${lang}-predownloaded.zip`)
                                    .then((stream) => resolve(stream));
                            });
                        }

                        else resolve(null);
                    }

                    else resolve(null);
                })
                .catch((error) => resolve(error));
        });
    }

    /**
     * Checks whether the update was downloaded or not
     */
    public static isUpdatePredownloaded(lang: string): Promise<boolean>
    {
        return new Promise(async (resolve) => {
            Neutralino.filesystem.getStats(`${await constants.paths.launcherDir}/voice-${lang}-predownloaded.zip`)
                .then(() => resolve(true))
                .catch(() => resolve(false));
        });
    }
}

export { Stream };
