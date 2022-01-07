import type Launcher from '../../Launcher';

import Game from '../../Game';
import Prefix from '../../core/Prefix';
import constants from '../../Constants';
import Debug from '../../core/Debug';

declare const Neutralino;

export default (launcher: Launcher): Promise<void> => {
    return new Promise(async (resolve) => {
        const prefixDir = await constants.paths.prefix.current;
        
        Prefix.exists(prefixDir).then((exists) => {
            if (!exists)
            {
                import('./CreatePrefix').then((module) => {
                    module.default(launcher).then(() => updateGame());
                });
            }

            else updateGame();
        });

        const updateGame = async () => {
            const prevGameVersion = await Game.current;

            Game.update(prevGameVersion).then((stream) => {
                launcher.progressBar?.init({
                    label: 'Downloading game...',
                    showSpeed: true,
                    showEta: true,
                    showPercents: true,
                    showTotals: true
                });
    
                stream?.downloadStart(() => launcher.progressBar?.show());
    
                stream?.downloadProgress((current: number, total: number, difference: number) => {
                    launcher.progressBar?.update(current, total, difference);
                });
    
                stream?.unpackStart(() => {
                    launcher.progressBar?.init({
                        label: 'Unpacking game...',
                        showSpeed: true,
                        showEta: true,
                        showPercents: true,
                        showTotals: true
                    });

                    // Showing progress bar again
                    // in case if this update was pre-downloaded
                    // and we skipped downloadStart event
                    launcher.progressBar?.show();
                });
    
                stream?.unpackProgress((current: number, total: number, difference: number) => {
                    launcher.progressBar?.update(current, total, difference);
                });
    
                stream?.unpackFinish(async () => {
                    const gameDir = await constants.paths.gameDir;

                    // Deleting outdated files
                    Neutralino.filesystem.readFile(`${gameDir}/deletefiles.txt`)
                        .then(async (files) => {
                            files = files.split(/\r\n|\r|\n/).filter((file) => file != '');

                            if (files.length > 0)
                            {
                                launcher.progressBar?.init({
                                    label: 'Deleting outdated files...',
                                    showSpeed: false,
                                    showEta: true,
                                    showPercents: true,
                                    showTotals: false
                                });

                                let current = 0, total = files.length;

                                for (const file of files)
                                {
                                    await Neutralino.filesystem.removeFile(`${gameDir}/${file}`);

                                    launcher.progressBar?.update(++current, total, 1);
                                }
                                
                                Debug.log({
                                    function: 'Launcher/States/Install',
                                    message: [
                                        'Deleted outdated files:',
                                        ...files
                                    ]
                                });
                            }

                            await Neutralino.filesystem.removeFile(`${gameDir}/deletefiles.txt`);

                            installVoice();
                        })
                        .catch(() => installVoice());

                    // Download voice package when the game itself has been installed
                    const installVoice = () => {
                        import('./InstallVoice').then((module) => {
                            module.default(launcher).then(() => resolve());
                        });
                    };
                });
            });
        };
    });
};
