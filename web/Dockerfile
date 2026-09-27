FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=43180
ENV HOSTNAME=0.0.0.0
COPY standalone/ ./
EXPOSE 43180
CMD ["node", "server.js"]
