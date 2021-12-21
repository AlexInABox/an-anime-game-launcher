import type { DXVK as TDXVK } from './types/DXVK';

import Constants from './Constants';
import AbstractInstaller from './AbstractInstaller';

declare const Neutralino;

class Stream extends AbstractInstaller
{
    public constructor(dxvk: TDXVK)
    {
        super(dxvk.uri, Constants.paths.dxvks);
    }
}

export default class DXVK
{
    /**
     * Get DXVKs list
     */
    public static get(): Promise<TDXVK[]>
    {
        return new Promise((resolve) => {
            Constants.paths.dxvks.then(async (dxvksDir: string) => {
                let list: TDXVK[] = JSON.parse(await Neutralino.filesystem.readFile(`${Constants.paths.app}/public/dxvks.json`));

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
     * Download DXVK to the [Constants.paths.dxvks] directory
     * 
     * @param dxvk DXVK object or version
     * @returns null if the DXVK with specified version dosen't exist. Otherwise - installation stream
     */
    public static download(dxvk: TDXVK|TDXVK['version']): Promise<null|Stream>
    {
        return new Promise(async (resolve) => {
            // If we provided dxvk parameter with a version of DXVK
            // then we should find this DXVK version and call this method for it
            if (typeof dxvk == 'string')
            {
                let foundDXVK = null;

                (await this.get()).forEach((currDxvk) => {
                    if (currDxvk.version == dxvk)
                        foundDXVK = currDxvk;
                });

                resolve(foundDXVK === null ? null : new Stream(foundDXVK));
            }

            // Otherwise we can use dxvk.uri and so on to download DXVK
            else resolve(new Stream(dxvk));
        });
    }
}

export type { TDXVK };
