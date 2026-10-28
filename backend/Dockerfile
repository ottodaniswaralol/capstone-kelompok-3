# Image backend ngeWARteg. Build dari ROOT repositori (butuh folder database/):
#   docker build -f backend/Dockerfile -t ngewarteg-api .
FROM node:20-slim

ENV NODE_ENV=production \
    TZ=Asia/Jakarta \
    PORT=3000

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/src ./src
COPY backend/scripts ./scripts
COPY database /app/database

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Siapkan database (aman diulang, data lama tidak dihapus), lalu jalankan API + scheduler
CMD ["sh", "-c", "node scripts/setup-db.js && node src/server.js"]
