import discordRpc, { Client, Presence } from 'discord-rpc';
import LauncherLib from './LauncherLib';

export default class DiscordRPC
{
    protected static readonly clientId = '901534333360304168';

    protected static rpc: any = null;

    public static init ()
    {
        this.rpc = new discordRpc.Client({ transport: 'ipc' }) as Client;
        
        this.rpc.login({ clientId: this.clientId }).catch(console.error);

        this.rpc.on('ready', () => {
            this.rpc.setActivity({
                details: LauncherLib.getConfig('rpcsettings.launcher'),
                largeImageKey: 'launcher',
                largeImageText: 'An Anime Game'
            });
        });
    }

    public static setActivity (activity: Presence): void
    {
        this.rpc.setActivity({
            ...activity,
            instance: false
        });
    }

    public static isActive (): boolean
    {
        return this.rpc !== null;
    }

    public static close (): void
    {
        this.rpc.clearActivity();
        this.rpc.destroy();

        this.rpc = null as any;
    }
}
