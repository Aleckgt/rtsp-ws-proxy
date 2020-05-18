import { readFileSync } from 'fs';
import { safeLoad, YAMLException } from 'js-yaml';
import * as logger from './logger';

class Settings {
    private data: any = {};
    static instance: Settings = new Settings();

    private constructor() {
        let buffer: string = '';
        try {
            buffer = readFileSync('/etc/rtsp-ws-proxy/streams.yml', 'utf8');
        } catch (e) {
            try {
                buffer = readFileSync('./streams.yml', 'utf8');
            } catch (e) {
                try {
                    buffer = readFileSync(process.argv[2], 'utf8');
                } catch (e) {
                    logger.error('Not found \"streams.yaml\"');
                    process.exit(1);
                }
            }
        }
        try {
            this.data = safeLoad(buffer);
            if (!(this.data && this.data.server && this.data.cameras && this.data.cameras.length !== 0)) {
                throw new YAMLException();
            }
        } catch (e) {
            logger.error(`Error parcing \"streams.yml\":\n ${e.message}`);
        }
    }

    static getInstance() {
        return this.instance ? this.instance : new Settings();
    }

    serverPort() {
        return this.data.server.port;
    }

    cameras() {
        return this.data.cameras;
    }
}


export default Settings.getInstance();