# rtsp-ws-proxy 
rtsp-ws-proxy allows to transfer rtsp-stream from ip-camera to a web browser via websockets. The output video stream is broadcast in the MPEG1 video-format (the audio decoding not implemented. You can add audio-decoding options if it needed). ffmeg is used to decode the input rtsp-stream (https://www.ffmpeg.org/). 

### Usage:
  1) copy streams.yml into /etc/rtsp-ws-proxy/
  2) fill streams.yml like this
  ```yaml
    camera1:
      stream: rtsp://b1.dnsdojo.com:1935/live/sys3.stream
      wsPort: 8081
      protocol: tcp
    camera2:
      stream: rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov
      wsPort: 8082
      protocol: udp
      ...
  ```
  3) start ws-proxy.js via node.js or start rtsp-ws-proxy
  4) on web page you can use [jsmpeg.js](https://github.com/phoboslab/jsmpeg) or similar.
  
  Example with jsmpeg
  ```html
    <script src="jsmpeg.min.js"></script>
    <div class="camera" data-url="ws://localhost:8081"></div> <!--stream from first camera-->
    <div class="camera" data-url="ws://localhost:8082"></div> <!--stream from second camera-->
  ```
      
