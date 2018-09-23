FROM node:10-alpine

WORKDIR /src
ADD package.json /src/
ADD yarn.lock /src/

RUN yarn install

ADD poller/index.js /src/poller.js

ENV HUE_USER=someAuthToken
ENV HUE_HOST=192.168.66.181
ENV NEONIOUS_HOST=192.168.66.189
ENV RED_LIGHT_ID=7
ENV GREEN_LIGHT_ID=8

CMD [ "node", "poller.js"]
