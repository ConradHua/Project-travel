import express from 'express';
import os from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from './db.js';

const app = express();
app.use(express.json());

app.get('/api/projects', (_req, res) => {
  const projects = db.prepare(`
    SELECT id, name, start_date AS startDate, end_date AS endDate, created_at AS createdAt
    FROM projects ORDER BY
      CASE WHEN date('now') BETWEEN start_date AND end_date THEN 0 ELSE 1 END,
      created_at DESC
  `).all();
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  const { name, startDate, endDate } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || !isDate(startDate) || !isDate(endDate) || startDate > endDate) {
    res.status(400).json({ error: '请填写项目名称及有效的开工日、完工日。' });
    return;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO projects (id, name, start_date, end_date) VALUES (?, ?, ?, ?)')
    .run(id, name.trim(), startDate, endDate);
  res.status(201).json(db.prepare(`SELECT id, name, start_date AS startDate, end_date AS endDate, created_at AS createdAt FROM projects WHERE id = ?`).get(id));
});

app.delete('/api/projects/:id', (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: '找不到该项目。' });
    return;
  }
  res.status(204).end();
});

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

app.use(express.static(join(process.cwd(), 'client', 'dist')));

const server = app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () => {
  const port = (server.address() as { port: number }).port;
  console.log(`本机访问：http://localhost:${port}`);
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) console.log(`局域网访问：http://${address.address}:${port}`);
    }
  }
});
