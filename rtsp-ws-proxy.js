const fs = require('fs');
const yaml = require('js-yaml');
const http = require('http');
const webSocket = require('ws');
const child_process = require('child_process');

let child_processes = new Map();
let cameras = {};

const argNum =  /^win/.test(process.platform) ? 3 : 2;

try {
    cameras = yaml.safeLoad(fs.readFileSync('/etc/rtsp-ws-proxy/streams.yml', 'utf8'));
} catch (e) {
    try {
        cameras = yaml.safeLoad(fs.readFileSync('streams.yml', 'utf8'));
    } catch (e) {
        try {
            cameras = yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8'));
        } catch (e) {
            console.log(e);
        }
    }
}

process.on('SIGINT', () => {
    for (let child of child_processes.keys()) {
        process.kill(-child);
    }
    process.exit(0);
});

const maxCamerasMaxPortNum = () => {
    let ports = [];
    for (const camera in cameras) {
        ports.push(cameras[camera].wsPort);
    }
    return Math.max.apply(null, ports);
};

const start_ffmpeg = (path, port, protocol) => {
    const ffmpeg = child_process.spawn('ffmpeg', [
        '-rtsp_transport', protocol,
        '-i', path,
        '-c:v', 'mpeg1video',
        '-f', 'mpegts',
        '-b:v', '5000k',
        //'-pre', 'ultrafast',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-r', '25',
        '-an',
        '-dn',
        '-sn',
        'http://localhost:' + port
    ], {
        detached: true,
        shell: true,
        stdio: 'ignore'
    }, (error) => {
        if (error) {
            console.error(error);
            this.kill();
            child_processes.delete(this.pid);
            console.log('Restarting ffmpeg');
            start_ffmpeg(path, port, protocol);
        }
    });

    ffmpeg.on('close', (code) => {
        console.log('Process ' + ffmpeg.pid + ' exit with code: ' + code + '. Restarting ffmpeg.');
        child_processes.delete(ffmpeg.pid);
        let args = ffmpeg.spawnargs[argNum];
        start_ffmpeg(args.match(/(rtsp:.+?)\s/i)[1], args.match(/http:.+:(\d{4})/)[1], args.match(/-rtsp_transport\s(tcp|udp)\s/i)[1]);
    });


    child_processes.set(ffmpeg.pid, ffmpeg);
    console.log('[' + ffmpeg.pid + '] ' + ffmpeg.spawnargs[argNum]);
};

let i = 1;
for (const camera in cameras) {
    const port = maxCamerasMaxPortNum() + i;
    initSocketServer(new webSocket.Server({port: cameras[camera].wsPort, perMessageDeflate: false}), port);
    start_ffmpeg(cameras[camera].stream, port, cameras[camera].protocol);
    i++;
}

function initSocketServer(socketServer, port) {
    socketServer.connectionCount = 0;
    socketServer.on('connection', (socket, upgradeReq) => {
        socketServer.connectionCount++;
        console.log(
            'New WebSocket Connection: ',
            (upgradeReq || socket.upgradeReq).socket.remoteAddress,
            (upgradeReq || socket.upgradeReq).headers['user-agent'],
            '(' + socketServer.connectionCount + ' total)'
        );
        socket.on('close', () => {
            socketServer.connectionCount--;
            console.log(
                'Disconnected WebSocket (' + socketServer.connectionCount + ' total)'
            );
        });
    });
    socketServer.broadcast = (data) => {
        socketServer.clients.forEach(function each(client) {
            if (client.readyState === webSocket.OPEN) {
                client.send(data);
            }
        });
    };

    const streamServer = http.createServer((request, response) => {
        response.connection.setTimeout(0);
        console.log(
            'Stream Connected: ' +
            request.socket.remoteAddress + ':' +
            request.socket.remotePort
        );
        request.on('data', (data) => {
            socketServer.broadcast(data);
            if (request.socket.recording) {
                request.socket.recording.write(data);
            }
        });
        request.on('end', () => {
            console.log('close');
            if (request.socket.recording) {
                request.socket.recording.close();
            }
        });
    }).listen(port, '127.0.0.1');
}
