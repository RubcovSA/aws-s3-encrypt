#FROM node:argon
FROM node:wheezy

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Bundle app source
COPY index.js /usr/src/app
COPY start.sh /usr/src/app
COPY .env /usr/src/app

EXPOSE 8080
CMD ["/bin/bash", "start.sh"]
#CMD [ "npm", "start" ]
