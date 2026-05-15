# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Build renderer (Vite) + server (esbuild via electron-vite)
RUN npx electron-vite build
# Compile pure server entry for Node.js
RUN npx tsc server/index.ts --outDir out --module commonjs --target ES2020 --esModuleInterop --skipLibCheck --moduleResolution node 2>/dev/null || \
    npx esbuild server/index.ts --bundle --platform=node --outfile=out/server/index.js --external:express --external:dockerode

# ---- Production stage ----
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/out/ ./out/
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/package.json ./

EXPOSE 20920
ENV PORT=20920 NODE_ENV=production
CMD ["node", "out/server/index.js"]
