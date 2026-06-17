FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Build produksi (bukan dev/Turbopack HMR — hindari reload-loop & panic di container).
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
