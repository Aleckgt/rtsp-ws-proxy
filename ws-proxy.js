const fs = require('fs');
const http = require('http');
const webSocket = require('ws');
const child_process = require('child_process');
const yaml = require('js-yaml');

let cameras = {};

try {
    cameras = yaml.safeLoad(fs.readFileSync('streams.yml', 'utf8'));
} catch (e) {
    console.log(e);
}

const maxCamerasMaxPortNum = function () {
    let ports = [];
    for (const camera in cameras) {
        ports.push(cameras[camera].port);
    }
    return Math.max.apply(null, ports);
};


let i = 1;
for (const camera in cameras) {
    const wsPort = cameras[camera].port;
    const port = maxCamerasMaxPortNum() + i;
    initSocketServer(new webSocket.Server({port: wsPort, perMessageDeflate: false}), port);
    ffmpeg(cameras[camera].stream, port);
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

function ffmpeg(path, port) {
    child_process.spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', path,
        '-codec:v', 'mpeg1video',
        '-f', 'mpegts',
        '-r', '25',
        'http://localhost:' + port
    ]);
}
