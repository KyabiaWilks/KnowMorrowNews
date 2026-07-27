FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=4000

USER node
EXPOSE 4000

CMD ["node", "src/index.js"]
