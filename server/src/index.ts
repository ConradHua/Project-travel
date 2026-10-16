import express from 'express';
import os from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from './db.js';

const app = express();
app.use(express.json());

const projectSelect = `SELECT id, name, start_date AS startDate, end_date AS endDate, created_at AS createdAt FROM projects`;
const memberSelect = `SELECT id, name, color, created_at AS createdAt FROM members`;
const taskSelect = `SELECT concrete_tasks.id, concrete_tasks.big_task_id AS bigTaskId, concrete_tasks.title, concrete_tasks.status, concrete_tasks.assignee_id AS assigneeId, members.name AS assigneeName, members.color AS assigneeColor FROM concrete_tasks LEFT JOIN members ON members.id = concrete_tasks.assignee_id`;

app.get('/api/projects', (_req, res) => {
  const projects = db.prepare(`${projectSelect} ORDER BY CASE WHEN date('now') BETWEEN start_date AND end_date THEN 0 ELSE 1 END, created_at DESC`).all();
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  const { name, startDate, endDate } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || !isDate(startDate) || !isDate(endDate) || startDate > endDate) {
    res.status(400).json({ error: '请填写项目名称及有效的开工日、完工日。' }); return;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO projects (id, name, start_date, end_date) VALUES (?, ?, ?, ?)').run(id, name.trim(), startDate, endDate);
  res.status(201).json(db.prepare(`${projectSelect} WHERE id = ?`).get(id));
});

app.delete('/api/projects/:id', (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) { res.status(404).json({ error: '找不到该项目。' }); return; }
  res.status(204).end();
});

app.get('/api/members', (_req, res) => res.json(db.prepare(`${memberSelect} ORDER BY created_at ASC`).all()));
app.post('/api/members', (req, res) => {
  const { name, color } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
    res.status(400).json({ error: '请填写成员名称并选择有效代表色。' }); return;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO members (id, name, color) VALUES (?, ?, ?)').run(id, name.trim(), color);
  res.status(201).json(db.prepare(`${memberSelect} WHERE id = ?`).get(id));
});
app.patch('/api/members/:id', (req, res) => {
  const { name, color } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
    res.status(400).json({ error: '请填写成员名称并选择有效代表色。' }); return;
  }
  const result = db.prepare('UPDATE members SET name = ?, color = ? WHERE id = ?').run(name.trim(), color, req.params.id);
  if (!result.changes) { res.status(404).json({ error: '找不到该成员。' }); return; }
  res.json(db.prepare(`${memberSelect} WHERE id = ?`).get(req.params.id));
});
app.delete('/api/members/:id', (req, res) => {
  const result = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  if (!result.changes) { res.status(404).json({ error: '找不到该成员。' }); return; }
  res.status(204).end();
});

app.post('/api/projects/:projectId/big-tasks', (req, res) => {
  const project = db.prepare('SELECT id, start_date AS startDate, end_date AS endDate FROM projects WHERE id = ?').get(req.params.projectId) as { id: string; startDate: string; endDate: string } | undefined;
  if (!project) { res.status(404).json({ error: '找不到该项目。' }); return; }
  const id = randomUUID();
  db.prepare('INSERT INTO big_tasks (id, project_id, title, start_date, end_date, color) VALUES (?, ?, ?, ?, ?, ?)').run(id, project.id, '新任务组', project.startDate, project.endDate, '#e76532');
  res.status(201).json({ id });
});

app.get('/api/projects/:projectId/detail', (req, res) => {
  const project = db.prepare(`${projectSelect} WHERE id = ?`).get(req.params.projectId);
  if (!project) { res.status(404).json({ error: '找不到该项目。' }); return; }
  const tasks = db.prepare(`${taskSelect} JOIN big_tasks ON big_tasks.id = concrete_tasks.big_task_id WHERE big_tasks.project_id = ? ORDER BY concrete_tasks.created_at ASC`).all(req.params.projectId);
  res.json({ project, tasks });
});
app.post('/api/projects/:projectId/tasks', (req, res) => {
  const { title, status = 'not-started', assigneeId = null } = req.body ?? {};
  const bigTask = db.prepare('SELECT id FROM big_tasks WHERE project_id = ? ORDER BY created_at ASC LIMIT 1').get(req.params.projectId) as { id: string } | undefined;
  if (!bigTask || typeof title !== 'string' || !title.trim() || !['not-started','in-progress','completed'].includes(status)) { res.status(400).json({ error: '请先创建任务分组并填写有效任务。' }); return; }
  if (assigneeId !== null && db.prepare('SELECT id FROM members WHERE id = ?').get(assigneeId) === undefined) { res.status(400).json({ error: '负责人不在当前花名册中。' }); return; }
  const id = randomUUID();
  db.prepare('INSERT INTO concrete_tasks (id, big_task_id, title, status, assignee_id) VALUES (?, ?, ?, ?, ?)').run(id, bigTask.id, title.trim(), status, assigneeId);
  res.status(201).json(db.prepare(taskSelect + ' WHERE concrete_tasks.id = ?').get(id));
});
app.patch('/api/tasks/:id', (req, res) => {
  const { title, status, assigneeId } = req.body ?? {};
  const current = db.prepare('SELECT id FROM concrete_tasks WHERE id = ?').get(req.params.id);
  if (!current) { res.status(404).json({ error: '找不到该任务。' }); return; }
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) { res.status(400).json({ error: '任务名称不能为空。' }); return; }
  if (status !== undefined && !['not-started','in-progress','completed'].includes(status)) { res.status(400).json({ error: '任务状态无效。' }); return; }
  if (assigneeId !== undefined && assigneeId !== null && db.prepare('SELECT id FROM members WHERE id = ?').get(assigneeId) === undefined) { res.status(400).json({ error: '负责人不在当前花名册中。' }); return; }
  const old = db.prepare('SELECT title, status, assignee_id AS assigneeId FROM concrete_tasks WHERE id = ?').get(req.params.id) as { title: string; status: string; assigneeId: string | null };
  db.prepare('UPDATE concrete_tasks SET title = ?, status = ?, assignee_id = ? WHERE id = ?').run(title?.trim() ?? old.title, status ?? old.status, assigneeId === undefined ? old.assigneeId : assigneeId, req.params.id);
  res.json(db.prepare(taskSelect + ' WHERE concrete_tasks.id = ?').get(req.params.id));
});
app.delete('/api/tasks/:id', (req, res) => {
  const result = db.prepare('DELETE FROM concrete_tasks WHERE id = ?').run(req.params.id);
  if (!result.changes) { res.status(404).json({ error: '找不到该任务。' }); return; }
  res.status(204).end();
});

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

const clientDist = join(process.cwd(), 'client', 'dist');
app.use(express.static(clientDist));
app.get(/.*/, (_req, res) => res.sendFile(join(clientDist, 'index.html')));
const server = app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () => {
  const port = (server.address() as { port: number }).port;
  console.log(`本机访问：http://localhost:${port}`);
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) for (const address of addresses ?? []) if (address.family === 'IPv4' && !address.internal) console.log(`局域网访问：http://${address.address}:${port}`);
});
