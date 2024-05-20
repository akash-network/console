FROM node:19-alpine

#RUN mkdir app
WORKDIR /app

# Bundle app source
COPY . .

RUN npm ci
RUN npm run build

EXPOSE 80
CMD [ "node", "/app/build/main.js" ]
