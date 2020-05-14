const date = `[${new Date().toLocaleString().replace(',', '')}]`;

export function info(message?: string) {
    console.log(`${date} [INFO]:\t ${message}`);
}

export function error(message?: string) {
    console.log(`${date} [ERROR]:\t ${message}`);
}

export function warn(message?: string) {
    console.log(`${date} [WARNING]:\t ${message}`);
}