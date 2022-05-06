const messageType = {
    info: {
        text: 'INFO',
        color: '\x1b[37m'
    },
    warn: {
        text: 'WARNING',
        color: '\x1b[33m'
    },
    error: {
        text: 'ERROR',
        color: '\x1b[31m'
    }
}

const logger = ( type: any, message?: string) => {
    console.log(type.color, `[${new Date().toLocaleString('ru-RU').replace(',', '')}] [${type.text}]:\t ${message}`)
}

export const info = (message?: string) => {
    logger(messageType.info, message);
}

export function error(message?: string) {
    logger(messageType.error, message);
}

export function warn(message?: string) {
    logger(messageType.warn, message);
}