FROM node:lts-alpine3.15

COPY . /opt/build

RUN cd /opt/build && yarn install && yarn build
RUN mkdir /opt/rtsp-ws-proxy \
    && cp /opt/build/build/* /opt/rtsp-ws-proxy \
    && cp -R /opt/build/config /opt/rtsp-ws-proxy \
    && cp -R /opt/build/node_modules /opt/rtsp-ws-proxy
RUN rm -rf /opt/build
RUN apk add ffmpeg

CMD ["node", "/opt/rtsp-ws-proxy/rtsp-ws-proxy.js",  "/opt/rtsp-ws-proxy/config/streams.yml"]
