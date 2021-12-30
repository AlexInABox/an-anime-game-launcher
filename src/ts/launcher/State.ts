import type Launcher from '../Launcher';
import type { LauncherState } from '../types/Launcher';

import Window from '../neutralino/Window';

import Game from '../Game';
import Patch from '../Patch';
import Voice from '../Voice';
import Runners from '../core/Runners';
import { DebugThread } from '../core/Debug';
import DXVK from '../core/DXVK';

declare const Neutralino;

export default class State
{
    public launcher: Launcher;

    public launchButton: HTMLElement;
    public predownloadButton: HTMLElement;
    public settingsButton: HTMLElement;

    protected _state: LauncherState = 'game-launch-available';

    protected events = {
        'runner-installation-required': import('./states/InstallWine'),
        'dxvk-installation-required': import('./states/InstallDXVK'),
        'game-launch-available': import('./states/Launch'),

        'game-installation-available': import('./states/Install'),
        'game-update-available': import('./states/Install'),
        'game-voice-update-required': import('./states/InstallVoice'),

        'test-patch-available': import('./states/ApplyPatch'),
        'patch-available': import('./states/ApplyPatch')
    };

    public constructor(launcher: Launcher)
    {
        this.launcher = launcher;

        this.launchButton = <HTMLElement>document.getElementById('launch');
        this.predownloadButton = <HTMLElement>document.getElementById('predownload');
        this.settingsButton = <HTMLElement>document.getElementById('settings');

        this.launchButton.onclick = () => {
            if (this.events[this._state])
            {
                this.launchButton.style['display'] = 'none';
                this.settingsButton.style['display'] = 'none';

                this.events[this._state].then((event) => {
                    event.default(this.launcher).then(() => {
                        this.update().then(() => {
                            this.launchButton.style['display'] = 'block';
                            this.settingsButton.style['display'] = 'block';
                        });
                    });
                });
            }
        };

        this.predownloadButton.onclick = () => {
            this.launchButton.style['display'] = 'none';
            this.predownloadButton.style['display'] = 'none';
            this.settingsButton.style['display'] = 'none';

            const module = this._state === 'game-pre-installation-available' ?
                'Predownload' : 'PredownloadVoice';

            import(`./states/${module}`).then((module) => {
                module.default(this.launcher).then(() => {
                    this.update().then(() => {
                        this.launchButton.style['display'] = 'block';
                        this.settingsButton.style['display'] = 'block';
                    });
                });
            });
        };

        this.update().then(() => {
            Neutralino.storage.setData('launcherLoaded', 'aboba');

            Window.current.show();
        });
    }

    /**
     * Get current launcher state
     */
    public get(): LauncherState
    {
        return this._state;
    }

    /**
     * Set launcher state
     */
    public set(state: LauncherState): void
    {
        this._state = state;

        this.launcher.progressBar!.hide();
        this.predownloadButton.style['display'] = 'none';

        switch(state)
        {
            case 'runner-installation-required':
                this.launchButton.textContent = 'Install wine';

                break;

            case 'dxvk-installation-required':
                this.launchButton.textContent = 'Install DXVK';

                break;
            
            case 'game-launch-available':
                this.launchButton.textContent = 'Launch';

                break;

            case 'game-pre-installation-available':
            case 'game-voice-pre-installation-available':
                this.launchButton.textContent = 'Launch';

                this.predownloadButton.style['display'] = 'block';

                break;

            case 'game-installation-available':
                this.launchButton.textContent = 'Install';

                break;

            case 'game-update-available':
            case 'game-voice-update-required':
                this.launchButton.textContent = 'Update';

                break;

            case 'patch-available':
                this.launchButton.textContent = 'Apply patch';

                break;

            case 'test-patch-available':
                this.launchButton.textContent = 'Apply test patch';

                this.launchButton.setAttribute('aria-label', 'This game version has an anti-cheat patch, but it is in the testing phase. You can wait a few days until it is stable or apply it at your own risk');

                break;

            case 'patch-unavailable':
                // todo some warning message
                this.launchButton.textContent = 'Patch unavailable';

                break;
        }
    }

    /**
     * Update launcher state
     * 
     * @returns new launcher state
     * 
     * This state will be automatically applied to the launcher
     * so you don't need to do it manually
     */
    public update(): Promise<string>
    {
        const debugThread = new DebugThread('State.update', 'Updating launcher state');

        return new Promise(async (resolve) => {
            let state: LauncherState|null = null;

            const runner = await Runners.current();
            const dxvk = await DXVK.current();

            // Check if the wine is installed
            if (runner === null)
            {
                debugThread.log('Runner is not specified');

                state = 'runner-installation-required';

                Runners.list().then((list) => {
                    for (const family of list)
                        for (const runner of family.runners)
                            if (runner.installed && runner.recommended)
                            {
                                debugThread.log(`Automatically selected runner ${runner.title} (${runner.name})`);

                                state = null;

                                Runners.current(runner).then(() => {
                                    this.update().then(resolve);
                                });

                                return;
                            }
                });

                if (state !== null)
                {
                    debugThread.log('No recommended runner installed');

                    this.set(state);

                    resolve(state);
                }
            }

            // Check if the DXVK is installed
            else if (dxvk === null)
            {
                debugThread.log('DXVK is not specified');

                state = 'dxvk-installation-required';

                DXVK.list().then((list) => {
                    for (const dxvk of list)
                        if (dxvk.installed && dxvk.recommended)
                        {
                            debugThread.log(`Automatically selected DXVK ${dxvk.version}`);

                            state = null;

                            DXVK.current(dxvk).then(() => {
                                this.update().then(resolve);
                            });

                            return;
                        }
                });

                if (state !== null)
                {
                    debugThread.log('No recommended DXVK installed');

                    this.set(state);

                    resolve(state);
                }
            }

            // Otherwise select some launcher state
            else
            {
                const gameCurrent = await Game.current;
                const gameLatest = await Game.getLatestData();
                const patch = await Patch.latest;
                const voiceData = await Voice.current;
                
                if (gameCurrent === null)
                    state = 'game-installation-available';
                
                else if (gameCurrent != gameLatest.game.latest.version)
                    state = 'game-update-available';

                // TODO: update this thing if the user selected another voice language
                else if (voiceData.installed.length === 0)
                    state = 'game-voice-update-required';

                else if (!patch.applied)
                {
                    state = patch.state == 'preparation' ?
                        'patch-unavailable' : (patch.state == 'testing' ?
                        'test-patch-available' : 'patch-available');
                }

                else if (gameLatest.pre_download_game && !await Game.isUpdatePredownloaded())
                    state = 'game-pre-installation-available';

                else if (gameLatest.pre_download_game && !await Voice.isUpdatePredownloaded(await Voice.selected))
                    state = 'game-voice-pre-installation-available';

                else state = 'game-launch-available';

                debugThread.log(`Updated state: ${state}`);

                this.set(state);

                resolve(state);
            }
        });
    }
};
