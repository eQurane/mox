# Используем ту же стабильную slim-версию
FROM node:24-slim

WORKDIR /app

# Просто копируем ВЕСЬ готовый код сервера и клиента
# Включая уже установленную папку node_modules
COPY server/ ./server/
COPY client/ ./client/

# Создаем директорию под медиа-файлы
RUN mkdir -p server/storage

WORKDIR /app/server

EXPOSE 3000

CMD ["npm", "start"]