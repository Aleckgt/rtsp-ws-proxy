const fs = require('fs');
const yaml = require('js-yaml');
const http = require('http');
const webSocket = require('ws');
const child_process = require('child_process');

const Logger = require('logger-nodejs');
const log = new Logger();

let child_processes = new Map();
let cameras = {};
let wsServers = new Map();
const argNum = /^win/.test(process.platform) ? 3 : 2;
const SERVER_PORT = 8080;

try {
    cameras = yaml.safeLoad(fs.readFileSync('/etc/rtsp-ws-proxy/streams.yml', 'utf8'));
} catch (e) {
    try {
        cameras = yaml.safeLoad(fs.readFileSync('streams.yml', 'utf8'));
    } catch (e) {
        try {
            cameras = yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8'));
        } catch (e) {
            log.fatal(e);
        }
    }
}

const server = http.createServer((req, res) => {
    const wsServer = wsServers.get(cameras[req.url.substring(1)].wsPort);
    req.on('data', (data) => {
        wsServer && wsServer.clients.forEach((client) => {
            if (client.readyState === webSocket.OPEN) {
                client.send(data);
            }
        });
    });
    req.on('close', () => {

    });
}).listen(SERVER_PORT, '127.0.0.1');
server.setTimeout(28800000, () => {

});

process.on('SIGINT', () => {
    for (let child of child_processes.keys()) {
        process.kill(-child);
    }
    process.exit(0);
});

const start_ffmpeg = (path, camera_name, protocol) => {
    const ffmpeg = child_process.spawn('ffmpeg', [
        '-rtsp_transport', protocol ? protocol : 'tcp',
        '-i', path,
        '-c:v', 'mpeg1video',
        '-f', 'mpegts',
        '-b:v', '5000k',
        '-bf', 0,
        '-r', '25',
        '-an',
        '-dn',
        '-sn',
        `http://localhost:${SERVER_PORT}/${camera_name}`
    ], {
        detached: true,
        shell: true,
        stdio: 'ignore'
    });

    ffmpeg.on('close', (code) => {
        child_processes.delete(ffmpeg.pid);
        if (code === 0) {
            log.info(`Process ${ffmpeg.pid} exit with code: ${code}. Restarting ffmpeg.`);
            start_ffmpeg(path, camera_name, protocol);
        } else {
            log.error(`Process ${ffmpeg.pid} exit with code: ${code}. Restarting ffmpeg.`);
            setTimeout(() => start_ffmpeg(path, camera_name, protocol), 3000);
        }
        
    });

    ffmpeg.on('error', err => {
        log.error(err.stack);
        ffmpeg.kill();
        child_processes.delete(this.pid);
        log.info('Restarting ffmpeg');
        setTimeout(() => start_ffmpeg(path, camera_name, protocol), 3000);
    });

    child_processes.set(ffmpeg.pid, ffmpeg);
    log.info(`[${ffmpeg.pid}] ${ffmpeg.spawnargs[argNum]}`);
};

for (const camera in cameras) {
    startWsServer(cameras[camera].wsPort, server);
    start_ffmpeg(cameras[camera].stream, camera, cameras[camera].protocol);
}

function startWsServer(wsPort, httpServer) {
    const wsServer = new webSocket.Server({ port: wsPort, server: httpServer });
    wsServers.set(wsPort, wsServer);
    wsServer.connectionCount = 0;
    wsServer.on('connection', (socket, req) => {
        wsServer.connectionCount++;
        log.info(`New WebSocket connection on port ${wsPort} from: ${req.socket.remoteAddress} (${wsServer.connectionCount} total)`);
        socket.on('close', () => {
            wsServer.connectionCount--;
            wsServers.delete(wsPort);
            log.info(`Disconnected WebSocket from port ${wsPort} (${wsServer.connectionCount} total)`);
        });
    });
}
