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

export const startProcess = (serverPort: Number, rtspPath: string, protocol: string, cameraName: string) => {
    const ffmpeg = spawn('ffmpeg', [
        '-rtsp_transport', protocol ? protocol : 'tcp',
        '-i', rtspPath,
        '-c:v', 'mpeg1video',
        '-f', 'mpegts',
        '-b:v', '5000k',
        '-bf', '0',
        '-r', '25',
        '-an',
        '-dn',
        '-sn',
        `http://localhost:${serverPort}/${cameraName}`
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
            setTimeout(() => startProcess(serverPort, rtspPath, protocol, cameraName), 1000);
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
        setTimeout(() => startProcess(serverPort, rtspPath, protocol, cameraName), 3000);
    };
};
