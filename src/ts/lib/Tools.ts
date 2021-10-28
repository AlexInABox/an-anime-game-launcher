const https = require('follow-redirects').https;

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

type GitTag = { tag: string, commit: string };

export class Tools
{
    public static async getGitTags (uri: string): Promise<GitTag[]>
    {
        return new Promise(resolve => {
            let git = spawn('git', ['ls-remote', '--tags', uri]),
                tags: GitTag[] = [];

            git.stdout.on('data', (data: string) => {
                data.toString().split(/\r\n|\r|\n/).forEach(line => {
                    if (line != '')
                    {
                        let matches = /^([0-9a-f]+)\trefs\/tags\/(.*)/.exec (line);

                        if (matches)
                            tags.push({
                                tag: matches[2],
                                commit: matches[1]
                            });
                    }
                });
            });

            git.on('close', () => resolve(tags));
        });
    }

    public static async downloadFile (uri: string, savePath: string, progress: (current: number, total: number, difference: number) => void): Promise<void|Error>
    {
        return new Promise((resolve, reject) => {
            https.get(uri, (response: any) => {
                let length = parseInt(response.headers['content-length'], 10),
                    total  = 0;

                response.on('data', (chunk: any) => {
                    total += chunk.length;

                    progress(total, length, chunk.length);

                    fs.appendFileSync(savePath, chunk);
                });

                response.on('end', () => resolve());
            }).on('error', (err: Error) => reject(err));
        });
    }

    public static async unzip (zipPath: string, unpackedPath: string, progress: (current: number, total: number, difference: number) => void): Promise<void|Error>
    {
        return new Promise((resolve, reject) => {
            let listenerProcess = spawn('unzip', ['-v', zipPath]),
                filesList = '';

            listenerProcess.stdout.on('data', (data: string) => filesList += data);

            listenerProcess.on('close', () => {
                let files = filesList.split(/\r\n|\r|\n/).slice(3, -3).map(line => {
                    line = line.trim();

                    if (line.slice(-1) == '/')
                        line = line.slice(0, -1);

                    let matches = /^(\d+)  [a-zA-Z\:]+[ ]+(\d+)[ ]+[0-9\-]+% [0-9\-]+ [0-9\:]+ [a-f0-9]{8}  (.+)/.exec(line);

                    if (matches)
                        return {
                            path: matches[3],
                            compressedSize: parseInt(matches[2]),
                            uncompressedSize: parseInt(matches[1])
                        };
                });

                let total = fs.statSync(zipPath)['size'], current = 0;
                let unpackerProcess = spawn('unzip', ['-o', zipPath, '-d', unpackedPath]);

                unpackerProcess.stdout.on('data', (data: string) => {
                    data.toString().split(/\r\n|\r|\n/).forEach(line => {
                        let items = line.split(': ');

                        if (items[1] !== undefined)
                        {
                            items[1] = path.relative(unpackedPath, items[1].trim());

                            files.forEach(file => {
                                if (file?.path == items[1])
                                {
                                    current += file.compressedSize;

                                    progress(current, total, file.compressedSize);
                                }
                            });
                        }
                    });
                });

                unpackerProcess.on('close', () => resolve());
            });
        });
    }

    public static async untar (tarPath: string, unpackedPath: string, progress: (current: number, total: number, difference: number) => void): Promise<void|Error>
    {
        return new Promise((resolve, reject) => {
            let listenerProcess = spawn('tar', ['-tvf', tarPath]),
                filesList = '', total = 0;

            listenerProcess.stdout.on('data', (data: string) => filesList += data);

            listenerProcess.on('close', () => {
                let files = filesList.split(/\r\n|\r|\n/).slice(3, -3).map(line => {
                    line = line.trim();

                    if (line.slice(-1) == '/')
                        line = line.slice(0, -1);

                    let matches = /^[dwxr\-]+ [\w/]+[ ]+(\d+) [0-9\-]+ [0-9\:]+ (.+)/.exec(line);

                    // TODO: compressedSize?
                    if (matches)
                    {
                        total += parseInt(matches[1]);

                        return {
                            path: matches[2],
                            uncompressedSize: parseInt(matches[1])
                        };
                    }
                });

                let current = 0;
                let unpackerProcess = spawn('tar', ['-xvf', tarPath, '-C', unpackedPath]);

                unpackerProcess.stdout.on('data', (data: string) => {
                    data.toString().split(/\r\n|\r|\n/).forEach(line => {
                        line = line.trim();

                        files.forEach(file => {
                            if (file?.path == line)
                            {
                                current += file.uncompressedSize; // compressedSize

                                progress(current, total, file.uncompressedSize); // compressedSize
                            }
                        });
                    });
                });

                unpackerProcess.on('close', () => resolve());
            });
        });
    }
}
