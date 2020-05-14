import { createServer, Server } from 'http';
import * as WebSocket from 'ws';
import * as logger from './logger';

import Settings from './settings';
import * as ffmpeg from './ffmpeg';
import { Socket } from 'net';

const settings = new Settings();

const wsServers = new Map();

const server = createServer(req => {
    const wsServer = wsServers.get(settings.cameras().find((it: { name: string; }) => req && req.url && it.name === req.url.substring(1)).wsPort);
    req.on('data', data => {
        wsServer && wsServer.clients.forEach((client: { readyState: any; send: (arg0: any) => void; }) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });
    req.on('close', () => {
        logger.info('connection closed');
    });
}).listen(settings.serverPort(), '127.0.0.1');
server.setTimeout(28800000, () => {

});

settings.cameras().forEach((it: any) => {
    createWsServer(it.wsPort, server);
    ffmpeg.startProcess(settings.serverPort(), it.stream, it.protocol, it.name);
});

function createWsServer(wsPort: number, httpServer: Server) {
    const wsServer = new WebSocket.Server({ port: wsPort, server: httpServer });
    wsServers.set(wsPort, wsServer);
    let connectionCount: number = 0;
    wsServer.on('connection', (socket: Socket, req: any) => {
        connectionCount++;
        logger.info(`New WebSocket connection on port ${wsPort} from: ${req.socket.remoteAddress} (${connectionCount} total)`);
        socket.on('close', () => {
            connectionCount--;
            wsServers.delete(wsPort);
            logger.info(`Disconnected WebSocket from port ${wsPort} (${connectionCount} total)`);
        });
        socket.on('error', (err) => {
            logger.error(err.stack);
        });
    });
}
