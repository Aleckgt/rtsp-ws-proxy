const fs = require('fs');
const yaml = require('js-yaml');
const http = require('http');
const webSocket = require('ws');
const child_process = require('child_process');

let child_processes = [];
let cameras = {};

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
    child_processes.forEach((child) => child.kill());
    process.exit(0);
});

const maxCamerasMaxPortNum = () => {
    let ports = [];
    for (const camera in cameras) {
        ports.push(cameras[camera].wsPort);
    }
    return Math.max.apply(null, ports);
};

let i = 1;
for (const camera in cameras) {
    const wsPort = cameras[camera].wsPort;
    const port = maxCamerasMaxPortNum() + i;
    initSocketServer(new webSocket.Server({port: wsPort, perMessageDeflate: false}), port);
    start_ffmpeg(cameras[camera].stream, port);
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
    }).listen(port);
}

function start_ffmpeg(path, port) {
    ffmpeg = child_process.spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', path,
        '-codec:v', 'mpeg1video',
        '-f', 'mpegts',
        '-b:v', '5000k',
        '-bf', '0',
        '-r', '25',
        'http://localhost:' + port
    ], {
        detached: true,
        shell: true,
        stdio: 'ignore'
    }, (error, stdout) => {
        if (error) {
            console.error(error);
        }
        console.log(stdout);
    });

    child_processes.push(ffmpeg);
    console.log('[' + ffmpeg.pid + '] ' + ffmpeg.spawnargs);

    ffmpeg.on('exit', (code) => console.log('child process exited with code ' + code));
}
