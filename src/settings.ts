import { readFileSync } from 'fs';
import { safeLoad, YAMLException } from 'js-yaml';
import * as logger from './logger';

class Settings {
    data: any;

    constructor() {
        let buffer: string = '';
        try {
            buffer = readFileSync('/etc/rtsp-ws-proxy/streams.yml', 'utf8');
        } catch (e) {
            try {
                buffer = readFileSync('./streams.yml', 'utf8');
            } catch (e) {
                try {
                    buffer = readFileSync(process.argv[2], 'utf8');
                    this.data = safeLoad(buffer);
                } catch (e) {
                    if (e instanceof YAMLException) {
                        logger.error(`Parse error of \"streams.yml\":\n ${e.message}`);
                    } else {
                        logger.error('Not found \"streams.yaml\"');
                    }
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