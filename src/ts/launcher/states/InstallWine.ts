import type Launcher from '../../Launcher';

import Runners from '../../core/Runners';
import DXVK from '../../core/DXVK';

export default (launcher: Launcher): Promise<void> => {
    return new Promise(async (resolve) => {
        Runners.download('lutris-GE-Proton7-29-x86_64').then((stream) => {
            launcher.progressBar?.init({
                label: 'Downloading Wine-GE-Proton 7-29...',
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
                    label: 'Unpacking Wine-GE-Proton 7-29...',
                    showSpeed: true,
                    showEta: true,
                    showPercents: true,
                    showTotals: true
                });
            });

            stream?.unpackProgress((current: number, total: number, difference: number) => {
                launcher.progressBar?.update(current, total, difference);
            });

            stream?.unpackFinish(async () => {
                // Select this runner
                await Runners.current('lutris-GE-Proton7-29-x86_64');

                // Create prefix if it is not created
                import('./CreatePrefix').then((module) => {
                    module.default(launcher).then(() => {
                        // Download DXVK if it wasn't downloaded
                        DXVK.current().then((dxvk) => {
                            if (dxvk === null)
                            {
                                import('./InstallDXVK').then((module) => {
                                    module.default(launcher).then(() => resolve());
                                });
                            }
        
                            else resolve();
                        });
                    });
                });
            });
        });
    });
};
