FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build && npm prune --omit=dev --legacy-peer-deps

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 NODE_EXTRA_CA_CERTS=/app/certs/supabase-root-2021-ca.crt HOME=/app XDG_CACHE_HOME=/app/.cache
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/certs ./certs
RUN chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","build/server/index.js"]
