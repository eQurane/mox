# Mox Backend

Node.js and Express.js backend with PostgreSQL support.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your PostgreSQL credentials and settings.

3. **Ensure PostgreSQL is running** on port 5432

4. **Start the server:**
   - Development mode (with auto-reload):
     ```bash
     npm run dev
     ```
   - Production mode:
     ```bash
     npm start
     ```

## Media storage

Uploaded files are stored in `server/storage/` and served at `/storage/<filename>` (see `src/paths.js`).

## API Endpoints

- `GET /api/health` - Health check endpoint

## Project Structure

```
server/
├── src/
│   ├── server.js          - Main server entry point
│   ├── db.js              - Database connection setup
│   └── routes/
│       └── health.js      - Health check routes
├── package.json           - Project dependencies
├── .env.example           - Environment variables template
└── README.md              - This file
```

## Database

The backend connects to PostgreSQL running on localhost:5432. You can customize the connection in `.env`.
