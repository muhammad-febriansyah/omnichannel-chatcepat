FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* di-inline ke bundle SAAT BUILD (bukan runtime) → wajib ada di build stage.
# Nilai datang dari build args (lihat docker-compose.prod.yml → build.args).
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_FB_APP_ID
ARG NEXT_PUBLIC_WA_CONFIG_ID
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_FB_APP_ID=$NEXT_PUBLIC_FB_APP_ID \
    NEXT_PUBLIC_WA_CONFIG_ID=$NEXT_PUBLIC_WA_CONFIG_ID

# Build produksi (bukan dev/Turbopack HMR — hindari reload-loop & panic di container).
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
