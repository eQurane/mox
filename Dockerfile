# --- Этап 1: Сборка зависимостей ---
FROM node:24-alpine AS builder
WORKDIR /app

# Копируем production-зависимости бэкенда
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Копируем код сервера и клиента
COPY server/ ./server/
COPY client/ ./client/

# Создаем директорию под медиа-файлы (на случай, если Express проверяет её наличие при старте)
RUN mkdir -p server/storage

# --- Этап 2: Финальный запуск ---
FROM node:24-alpine

WORKDIR /app

# Переносим чистую сборку
COPY --from=builder /app /app

WORKDIR /app/server

EXPOSE 3000

CMD ["npm", "start"]