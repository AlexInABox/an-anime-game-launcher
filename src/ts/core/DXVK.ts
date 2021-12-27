import type { DXVK as TDXVK } from '../types/DXVK';

import constants from '../Constants';
import Configs from '../Configs';
import AbstractInstaller from './AbstractInstaller';
import Process from '../neutralino/Process';
import promisify from './promisify';
import Runners from './Runners';

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
                Configs.set('dxvk', typeof dxvk === 'string' ?
                    dxvk : dxvk.version);

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
        return new Promise((resolve) => {
            constants.paths.dxvksDir.then(async (dxvksDir: string) => {
                let list: TDXVK[] = JSON.parse(await Neutralino.filesystem.readFile(`${constants.paths.appDir}/public/dxvks.json`));

                const installed: { entry: string, type: string }[] = await Neutralino.filesystem.readDirectory(dxvksDir);

                let dxvks: TDXVK[] = [];

                list.forEach((dxvk) => {
                    let inst = false;

                    for (let dir of installed)
                        inst ||= dir.entry == `dxvk-${dxvk.version}`;

                    dxvks.push({
                        ...dxvk,

                        installed: inst
                    });
                });

                resolve(dxvks);
            });
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
        return new Promise(async (resolve) => {
            const version = typeof dxvk !== 'string' ?
                dxvk.version : dxvk;

            Process.run(`rm -rf '${Process.addSlashes(await constants.paths.dxvksDir + '/dxvk-' + version)}'`)
                .then((process) => {
                    process.finish(() => resolve());
                });
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
            
            const dxvkDir = `${await constants.paths.dxvksDir}/dxvk-${version}`;
            const runner = await Runners.current();
            const runnerDir = `${await constants.paths.runnersDir}/${runner?.name}`;

            const pipeline = promisify({
                callbacks: [
                    /**
                     * Make the installation script executable
                     */
                    () => Neutralino.os.execCommand(`chmod +x '${dxvkDir}/setup_dxvk.sh'`),

                    /**
                     * And then run it
                     */
                    (): Promise<void> => new Promise(async (resolve) => {
                        Process.run(`bash '${dxvkDir}/setup_dxvk.sh' install`, {
                            cwd: dxvkDir,
                            env: {
                                WINE: runner ? `${runnerDir}/${runner.files.wine}` : 'wine',
                                WINECFG: runner ? `${runnerDir}/${runner.files.winecfg}` : 'winecfg',
                                WINESERVER: runner ? `${runnerDir}/${runner.files.wineserver}` : 'wineserver',
                                WINEPREFIX: prefix
                            }
                        }).then((process) => {
                            process.finish(() => resolve());
                        });
                    })
                ]
            });

            pipeline.then(() => resolve());
        });
    }
}

export type { TDXVK };
