import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import collectionsRouter from './routes/collections.js';
import mediaRouter from './routes/media.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', '..', 'client');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', projectsRouter);
app.use('/api', tasksRouter);
app.use('/api', collectionsRouter);
app.use('/api', mediaRouter);
app.use(express.static(clientDir));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;
