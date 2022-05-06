import { spawn, ChildProcess } from 'child_process';
import * as logger from './logger';

const argNum = /^win/.test(process.platform) ? 3 : 2;

const processes = new Map<number, ChildProcess>();

process.on('SIGINT', () => {
    processes.forEach((ffmpeg) => {
        ffmpeg.kill();
    });
    process.exit(0);
});

export const startProcess = (serverPort: number, camera: any) => {
    const ffmpeg = spawn('ffmpeg', [
        '-stimeout 10000000',
        `-rtsp_transport ${camera.protocol ? camera.protocol : 'tcp'}`,
        `-i ${camera.stream}`,
        '-c:v mpeg1video',
        '-f mpegts',
        camera.bitrate && `-b:v ${camera.bitrate}`,
        `-r ${camera.fps ? camera.fps : 25}`,
        '-an -sn -dn',
        `http://localhost:${serverPort}/${camera.name}`
    ], {
        shell: true,
        detached: true,
        stdio: 'pipe'
    });

    if (ffmpeg && ffmpeg.pid) {
        const ffmpegPid: number = ffmpeg.pid;
        logger.info(`[${ffmpegPid}] ${ffmpeg.spawnargs[argNum]}`);
        processes.set(ffmpegPid, ffmpeg);

        ffmpeg.on('exit', code => {
            processes.delete(ffmpegPid);
            switch (code) {
                case 0: {
                    logger.info(`[${ffmpegPid}] ffmpeg exit with code: ${code}. Restarting ffmpeg...`);
                    setTimeout(() => startProcess(serverPort, camera), 1000);
                    break;
                };
                case 127: {
                    logger.error('ffmpeg not found');
                    process.exit(1);
                }
                default: {
                    logger.error(`[${ffmpeg.pid}] ffmpeg exit with code: ${code}`);
                    errorAction();
                }
            }
        });

        ffmpeg.on('error', err => {
            logger.error(err.stack);
            errorAction();
        });

        ffmpeg.stdout.on('data', (data) => {
            logger.info(`Received chunk ${data}`);
          });

        const errorAction = () => {
            ffmpeg.kill();
            processes.delete(ffmpegPid);
            logger.warn('Restarting ffmpeg...');
            setTimeout(() => startProcess(serverPort, camera), 3000);
        };
    } else {
        logger.error('Error creating ffmpeg');
    }
};
