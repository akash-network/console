FROM node:18-alpine

# Create app directory

#RUN mkdir app
WORKDIR /app

# Bundle app source
COPY . .

WORKDIR /app/shared
RUN npm ci

WORKDIR /app/api
RUN npm ci
RUN npm run build

EXPOSE 80
CMD [ "node", "/app/api/dist/server.js" ]