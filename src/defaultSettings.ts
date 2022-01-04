import Configs from './ts/Configs';
import constants from './ts/Constants';
import promisify from './ts/core/promisify';

promisify(async () => {
    Configs.defaults({
        lang: {
            launcher: 'en-us',
            voice: [
                'en-us'
            ]
        },
    
        /**
         * Path to wine prefix
         * 
         * @default constants.paths.prefix.default
         */
        prefix: await constants.paths.prefix.default,
    
        /**
         * Runner name to use, or null if runner is not specified
         * 
         * @default null
         */
        runner: null,
    
        /**
         * DXVK name to use, or null if DXVK is not specified
         * 
         * @default null
         */
        dxvk: null,

        /**
         * Environment variables
         * 
         * @default null
         */
        env: null,
    
        /**
         * Launcher theme
         * 
         * Can be "system", "light" and "dark"
         * 
         * @defaul "system"
         */
        theme: 'system',
    
        /**
         * HUD
         * 
         * "none" if not in use. Otherwise it's "dxvk" or "mangohud"
         * 
         * @default "none"
         */
        hud: 'none',
    
        /**
         * vkBasalt preset to use
         * 
         * "none" if not in use. Otherwise it should be a folder name from the "shaders" folder
         * 
         * @default "none"
         */
        shaders: 'none',

        /**
         * Discord RPC integration
         */
        discord: {
            /**
             * If it is enabled
             * 
             * @default false
             */
            enabled: false,

            /**
             * RPC settings
             */
            fields: {
                /**
                 * Launcher title
                 */
                title: 'An Anime Game Launcher',

                /**
                 * Small messages after title
                 */
                state: {
                    /**
                     * Message showed when you're in game
                     */
                    'in-launcher': 'Playing the game',

                    /**
                     * Message showed when you're in launcher
                     */
                    'in-game': 'Preparing to launch'
                },

                /**
                 * RPC icon name
                 */
                icon: 'launcher',

                /**
                 * Should it display amount of spent time or not
                 */
                timer: true
            }
        },

        /**
         * If the launcher should use GameMode
         * 
         * @default false
         */
        gamemode: false,

        /**
         * If the launcher should unlock FPS
         * 
         * @default false
         */
        fps_unlocker: false,

        /**
         * If the launcher should automatically delete DXVK log files
         * 
         * @default true
         */
        purge_dxvk_logs: true
    });
});
