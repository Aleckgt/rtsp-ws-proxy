FROM node:15.9.0-alpine3.13

WORKDIR /rtsp-ws-proxy

COPY package.json package.json
COPY tsconfig.json tsconfig.json
COPY src src
COPY config config

RUN npm i
RUN npm run-script build

CMD ["node", "build/rtsp-ws-proxy.js", "config/streams.yml"]
