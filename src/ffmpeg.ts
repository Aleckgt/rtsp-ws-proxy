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
        stdio: 'ignore'
    });

    logger.info(`[${ffmpeg.pid}] ${ffmpeg.spawnargs[argNum]}`);
    processes.set(ffmpeg.pid, ffmpeg);

    ffmpeg.on('exit', code => {
        processes.delete(ffmpeg.pid);
        if (code === 0) {
            logger.info(`ffmpeg [${ffmpeg.pid}] exit with code: ${code}. Restarting ffmpeg.`);
            setTimeout(() => startProcess(serverPort, camera), 1000);
        } else {
            logger.error(`ffmpeg [${ffmpeg.pid}] exit with code: ${code}`);
            errorAction();
        }
    });

    ffmpeg.on('error', err => {
        logger.error(err.stack);
        errorAction();
    });

    const errorAction = () => {
        ffmpeg.kill();
        processes.delete(ffmpeg.pid);
        logger.warn('Restarting ffmpeg');
        setTimeout(() => startProcess(serverPort, camera), 3000);
    };
};
