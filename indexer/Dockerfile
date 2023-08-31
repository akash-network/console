FROM node:18-alpine

# Create app directory

#RUN mkdir app
WORKDIR /app

# Bundle app source
COPY . .

WORKDIR /app/shared
RUN npm ci

WORKDIR /app/indexer
RUN npm ci
RUN npm run build

EXPOSE 80
#EXPOSE 3079

CMD [ "node", "/app/indexer/dist/server.js" ]