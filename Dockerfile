# 可选：一个镜像同时提供 API、管理后台（/admin）和 H5 用户端（/）
FROM node:20-alpine AS build
WORKDIR /app
COPY admin/package*.json admin/
COPY client/package*.json client/.npmrc client/
RUN npm --prefix admin ci && npm --prefix client ci
COPY admin admin
COPY client client
RUN cd admin && npx vite build --base=/admin/ && cd ../client && npm run build:h5

FROM node:20-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server ./
COPY --from=build /app/admin/dist /app/server/public/admin
COPY --from=build /app/client/dist/build/h5 /app/server/public/h5
ENV PORT=3000 SERVE_STATIC=1
EXPOSE 3000
VOLUME ["/app/server/data", "/app/server/uploads"]
CMD ["node", "src/index.js"]
