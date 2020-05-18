import { createServer, Server } from 'http';
import * as WebSocket from 'ws';
import * as logger from './logger';

import Settings from './settings';
import * as ffmpeg from './ffmpeg';
import { Socket } from 'net';

const wsServers = new Map();

const server = createServer(req => {
    const wsServer = wsServers.get(Settings.cameras().find((it: { name: string; }) => req && req.url && it.name === req.url.substring(1)).wsPort);
    req.on('data', data => {
        wsServer && wsServer.clients.forEach((client: any) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });
    req.on('close', () => {
        logger.info('connection closed');
    });
}).listen(Settings.serverPort(), '127.0.0.1');
server.setTimeout(28800000, () => {

});

Settings.cameras().forEach((it: any) => {
    createWsServer(it.wsPort, server);
    ffmpeg.startProcess(Settings.serverPort(), it);
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
