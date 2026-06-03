# --- Этап 1: Сборка зависимостей ---
FROM node:24-slim AS builder
WORKDIR /app

# Копируем production-зависимости бэкенда
COPY server/package*.json ./server/
RUN cd server && \
    npm config set registry https://registry.npmmirror.com && \
    npm ci --omit=dev && \
    npm cache clean --force

# Копируем код сервера и клиента
COPY server/ ./server/
COPY client/ ./client/

# Создаем директорию под медиа-файлы (на случай, если Express проверяет её наличие при старте)
RUN mkdir -p server/storage

# --- Этап 2: Финальный запуск ---
FROM node:24-slim

WORKDIR /app

# Переносим чистую сборку
COPY --from=builder /app /app

WORKDIR /app/server

EXPOSE 3000

CMD ["npm", "start"]