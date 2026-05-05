import express from 'express';
import pool from '../db.js';

const router = express.Router(); // /api/....

router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.get('/health/db', async (req, res) => {
  try {
    const dbNameResult = await pool.query('SELECT current_database()');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    res.json({
      status: 'OK',
      database: 'Connected',
      databaseName: dbNameResult.rows[0].current_database,
      tables: tablesResult.rows.map(row => row.table_name),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'Disconnected',
      error: error.message,
    });
  }
});

export default router;
