FROM node:14-alpine
ENV NODE_ENV=production

# install openssl
RUN apk update \
	&& apk add --no-cache openssl python3 make g++\
	&& rm -rf /var/lib/apt/lists/* \
	&& rm -rf /var/cache/apk/*

WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY . .
EXPOSE 8080
RUN chown -R node /usr/src/app
USER node
ENTRYPOINT ["node", "server.js"]
