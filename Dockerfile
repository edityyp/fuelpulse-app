FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 NODE_EXTRA_CA_CERTS=/app/certs/supabase-root-2021-ca.crt HOME=/app XDG_CACHE_HOME=/app/.cache
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip libglib2.0-0 libgl1 && rm -rf /var/lib/apt/lists/* && python3 -m pip install --break-system-packages --no-cache-dir 'fast-alpr[onnx]==0.4.0'
RUN mkdir -p /app/.cache && python3 -c "from fast_alpr import ALPR; ALPR(detector_model='yolo-v9-t-384-license-plate-end2end',ocr_model='cct-xs-v2-global-model',ocr_device='cpu')"
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/certs ./certs
COPY --from=build /app/server/alpr_worker.py ./server/alpr_worker.py
RUN chown -R node:node /app/.cache /app/server
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","build/server/index.js"]
