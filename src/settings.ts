import { readFileSync } from 'fs';
import { safeLoad } from 'js-yaml';
import * as logger from './logger';

class Settings {
    data: any;

    constructor() {
        try {
            this.data = safeLoad(readFileSync('/etc/rtsp-ws-proxy/streams.yml', 'utf8'));
        } catch (e) {
            try {
                this.data = safeLoad(readFileSync('./streams.yml', 'utf8'));
            } catch (e) {
                try {
                    this.data = safeLoad(readFileSync(process.argv[2], 'utf8'));
                } catch (e) {
                    logger.error('Not found \"streams.yaml\"');
                    process.exit(1);
                }
            }
        }
    }

    serverPort() {
        return this.data.server.port;
    }

    cameras() {
        return this.data.cameras;
    }
}

export default Settings;