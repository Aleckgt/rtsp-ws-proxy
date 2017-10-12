const fs = require('fs');
const yaml = require('js-yaml');
const http = require('http');
const webSocket = require('ws');
const child_process = require('child_process');

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

const maxCamerasMaxPortNum = function () {
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
    socketServer.on('connection', function (socket, upgradeReq) {
        socketServer.connectionCount++;
        console.log(
            'New WebSocket Connection: ',
            (upgradeReq || socket.upgradeReq).socket.remoteAddress,
            (upgradeReq || socket.upgradeReq).headers['user-agent'],
            '(' + socketServer.connectionCount + ' total)'
        );
        socket.on('close', function () {
            socketServer.connectionCount--;
            console.log(
                'Disconnected WebSocket (' + socketServer.connectionCount + ' total)'
            );
        });
    });
    socketServer.broadcast = function (data) {
        socketServer.clients.forEach(function each(client) {
            if (client.readyState === webSocket.OPEN) {
                client.send(data);
            }
        });
    };

    const streamServer = http.createServer(function (request, response) {
        response.connection.setTimeout(0);
        console.log(
            'Stream Connected: ' +
            request.socket.remoteAddress + ':' +
            request.socket.remotePort
        );
        request.on('data', function (data) {
            socketServer.broadcast(data);
            if (request.socket.recording) {
                request.socket.recording.write(data);
            }
        });
        request.on('end', function () {
            console.log('close');
            if (request.socket.recording) {
                request.socket.recording.close();
            }
        });
    }).listen(port);
}

function start_ffmpeg(path, port) {
    ffmpeg = child_process.execFile('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', path,
        '-codec:v', 'mpeg1video',
        '-f', 'mpegts',
        '-b:v', '5000k',
        '-bf', '0',
        '-r', '25',
        'http://localhost:' + port
    ], (error, stdout) => {
        if (error) {
            console.error(error);
        }
        console.log(stdout);
    });
}
