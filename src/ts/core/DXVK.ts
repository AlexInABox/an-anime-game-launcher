import YAML from 'yaml';

import type { DXVK as TDXVK } from '../types/DXVK';

import { Configs, Process, promisify, path, Cache, fetch } from '../../empathize';
import { DebugThread } from '@empathize/framework/dist/meta/Debug';

import constants from '../Constants';
import AbstractInstaller from './AbstractInstaller';
import Runners from './Runners';

// If true, dxvk list will be loaded directly from the file
// instead of the repository
// 
// ! Should always be false for release builds
const LOAD_DIRECTLY = false;

declare const Neutralino;

class Stream extends AbstractInstaller
{
    public constructor(dxvk: TDXVK)
    {
        super(dxvk.uri, constants.paths.dxvksDir);
    }
}

export default class DXVK
{
    /**
     * Get the current DXVK according to the config file
     * or set the new one
     */
    public static current(dxvk: TDXVK|TDXVK['version']|null = null): Promise<TDXVK|null>
    {
        return new Promise(async (resolve) => {
            if (dxvk === null)
            {
                Configs.get('dxvk').then((dxvk) => {
                    if (typeof dxvk === 'string')
                        DXVK.get(dxvk).then((dxvk) => resolve(dxvk));
    
                    else resolve(null);
                });
            }
            
            else
            {
                await Configs.set('dxvk', typeof dxvk === 'string' ?
                    dxvk : dxvk.version);

                await Configs.flush();

                resolve(typeof dxvk === 'string' ?
                    await this.get(dxvk) : dxvk);
            }
        });
    }

    /**
     * Get DXVKs list
     */
    public static list(): Promise<TDXVK[]>
    {
        return new Promise(async (resolve) => {
            const dxvksDir = await constants.paths.dxvksDir;

            Neutralino.filesystem.readDirectory(dxvksDir)
                .then((folders) => resolveList(folders))
                .catch(() => resolveList([]));

            const resolveList = async (folders: { entry: string, type: string }[]) => {
                let list: TDXVK[] = [];
                let dxvks: TDXVK[] = [];

                const dxvk_list = await Cache.get('DXVK.list.remote');

                // If the dxvks cache is no expired - return it
                if (!LOAD_DIRECTLY && dxvk_list && !dxvk_list.expired)
                    list = dxvk_list.value['list'];

                else
                {
                    // Otherwise fetch remote list
                    const response = await fetch(constants.uri.dxvk_list, 1500);

                    // If it wasn't fetched - load locally stored one
                    if (!response.ok || LOAD_DIRECTLY)
                        list = YAML.parse(await Neutralino.filesystem.readFile(`${constants.paths.appDir}/public/dxvks.yaml`));

                    else
                    {
                        // Otherwise if the fetched list have the same content length as cached one
                        // then ignore it and use the cached one because they're the same
                        // otherwise load remote one
                        list = dxvk_list && dxvk_list.value['length'] == response.length ?
                            dxvk_list.value['list'] :
                            YAML.parse(await response.body());

                        // Update the cache record for the next 24 hours
                        Cache.set('DXVK.list.remote', {
                            length: response.length,
                            list: list
                        }, 3600 * 24);
                    }
                }

                list.forEach((dxvk) => {
                    let inst = false;

                    for (let dir of folders)
                        inst ||= dir.entry == `dxvk-${dxvk.version}`;

                    dxvks.push({
                        ...dxvk,

                        installed: inst
                    });
                });

                resolve(dxvks);
            };
        });
    }

    /**
     * Get DXVK with specified version
     */
    public static get(version: string): Promise<TDXVK|null>
    {
        return new Promise((resolve) => {
            this.list().then((list) => {
                for (const dxvk of list)
                    if (dxvk.version === version)
                    {
                        resolve(dxvk);

                        return;
                    }

                resolve(null);
            });
        });
    }

    /**
     * Download DXVK to the [constants.paths.dxvks] directory
     * 
     * @param dxvk DXVK object or version
     * @returns null if the specified version of DXVK dosen't exist. Otherwise - installation stream
     */
    public static download(dxvk: TDXVK|TDXVK['version']): Promise<null|Stream>
    {
        return new Promise(async (resolve) => {
            // If we provided dxvk parameter with a version of DXVK
            // then we should find this DXVK version and call this method for it
            if (typeof dxvk == 'string')
            {
                this.list().then((list) => {
                    let foundDXVK;
                    
                    list.forEach((currDxvk) => {
                        if (currDxvk.version == dxvk)
                            foundDXVK = currDxvk;
                    });
    
                    resolve(foundDXVK === null ? null : new Stream(foundDXVK));
                });
            }

            // Otherwise we can use dxvk.uri and so on to download DXVK
            else resolve(new Stream(dxvk));
        });
    }

    /**
     * Delete specified DXVK
     */
    public static delete(dxvk: TDXVK|TDXVK['version']): Promise<void>
    {
        const debugThread = new DebugThread('DXVK.delete', `Deleting DXVK ${typeof dxvk === 'string' ? dxvk : dxvk.version}`);

        return new Promise(async (resolve) => {
            const version = typeof dxvk !== 'string' ?
                dxvk.version : dxvk;

            await Neutralino.os.execCommand(`rm -rf "${path.addSlashes(await constants.paths.dxvksDir)}/dxvk-${version}"`);

            debugThread.log('Deletion completed');

            resolve();
        });
    }

    /**
     * Apply DXVK to the prefix
     */
    public static apply(prefix: string, dxvk: TDXVK|TDXVK['version']): Promise<void>
    {
        return new Promise(async (resolve) => {
            const version = typeof dxvk !== 'string' ?
                dxvk.version : dxvk;

            const debugThread = new DebugThread('DXVK.apply', `Applying DXVK ${version}`);
            
            const dxvkDir = `${await constants.paths.dxvksDir}/dxvk-${version}`;
            const runner = await Runners.current();
            const runnerDir = `${await constants.paths.runnersDir}/${runner?.name}`;

            let setupScript: string = await Neutralino.filesystem.readFile(`${path.addSlashes(dxvkDir)}/setup_dxvk.sh`);

            // Update wine paths
            setupScript = setupScript.replaceAll(/wine=".*"/g, `wine="${runnerDir}/${runner!.files.wine.replace('64', '')}"`);
            setupScript = setupScript.replaceAll(/wine64=".*"/g, `wine64="${runnerDir}/${runner!.files.wine}"`);
            setupScript = setupScript.replaceAll(/wineboot=".*"/g, `wineboot="${runnerDir}/${runner!.files.wine.replace('64', 'boot')}"`);

            // Use wine64 to update wine prefix instead of running wineboot
            setupScript = setupScript.replaceAll('$wineboot -u', '"$wine64" -u');

            // Fix issues related to spaces in paths to the runners folder
            setupScript = setupScript.replaceAll('which $wineboot', 'which "$wineboot"');
            setupScript = setupScript.replaceAll('$wine --version', '"$wine" --version');
            setupScript = setupScript.replaceAll('$wine64 winepath', '"$wine64" winepath');
            setupScript = setupScript.replaceAll('$wine winepath', '"$wine" winepath');
            setupScript = setupScript.replaceAll('$wine reg', '"$wine" reg');

            // Update setup script
            Neutralino.filesystem.writeFile(`${path.addSlashes(dxvkDir)}/setup_dxvk.sh`, setupScript);

            const pipeline = promisify({
                callbacks: [
                    /**
                     * Make the installation script executable
                     */
                    () => Neutralino.os.execCommand(`chmod +x "${dxvkDir}/setup_dxvk.sh"`),

                    /**
                     * And then run it
                     */
                    (): Promise<void> => new Promise(async (resolve) => {
                        const alias = runner ? `alias winecfg="${runnerDir}/${runner.files.winecfg}"` : 'true';

                        Process.run(`sh -c '${alias};./setup_dxvk.sh install'`, {
                            cwd: dxvkDir,
                            env: {
                                WINE: runner ? `${runnerDir}/${runner.files.wine}` : 'wine',
                                WINESERVER: runner ? `${runnerDir}/${runner.files.wineserver}` : 'wineserver',
                                WINEPREFIX: prefix
                            }
                        }).then((process) => {
                            let processOutput = '';

                            process.output((output) => processOutput += output);

                            process.finish(() => {
                                debugThread.log({
                                    message: [
                                        'Setup script output:',
                                        ...processOutput.split(/\r\n|\r|\n/)
                                    ]
                                });

                                resolve();
                            });
                        });
                    })
                ]
            });

            pipeline.then(() => {
                debugThread.log('Applying completed');

                resolve();
            });
        });
    }
}

export type { TDXVK };
