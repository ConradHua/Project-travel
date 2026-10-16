import { FormEvent, useEffect, useState } from 'react';

type Member = { id: string; name: string; color: string };
type Task = { id: string; title: string; status: string; assigneeId: string | null; assigneeName?: string; assigneeColor?: string };
type Project = { id: string; name: string; startDate: string; endDate: string };

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? '操作失败，请重试。'); }
  return response.status === 204 ? undefined as T : response.json();
}

export function ProjectDetailPage({ id }: { id: string }) {
  const [project, setProject] = useState<Project>();
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memberForm, setMemberForm] = useState({ name: '', color: '#e76532' });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [detail, roster] = await Promise.all([json<{ project: Project; tasks: Task[] }>(`/api/projects/${id}/detail`), json<Member[]>('/api/members')]);
      setProject(detail.project); setTasks(detail.tasks); setMembers(roster); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '读取失败。'); }
  }
  useEffect(() => { void load(); }, [id]);
  if (!project) return <main className="shell"><div className="empty-state">正在读取项目…</div></main>;

  async function saveMember(event: FormEvent) {
    event.preventDefault();
    try {
      const method = editing ? 'PATCH' : 'POST';
      await json<Member>(editing ? `/api/members/${editing}` : '/api/members', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(memberForm) });
      setMemberForm({ name: '', color: '#e76532' }); setEditing(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : '成员保存失败。'); }
  }
  async function removeMember(member: Member) {
    if (!window.confirm(`确定删除成员「${member.name}」吗？已分配给他的任务会保留，但负责人将变为未指派。`)) return;
    try { await json(`/api/members/${member.id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(e instanceof Error ? e.message : '删除失败。'); }
  }
  async function addTask() {
    try {
      await json(`/api/projects/${id}/big-tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      await json(`/api/projects/${id}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '新具体任务' }) }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : '任务创建失败。'); }
  }
  async function updateTask(task: Task, patch: Partial<Task>) {
    try { await json(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : '任务保存失败。'); }
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="/" aria-label="工地首页"><span className="brand-mark" aria-hidden="true">工</span><span>工地</span></a><a className="back-link" href="/">返回项目</a></header>
    {error && <div role="alert" className="alert">{error}<button onClick={() => void load()}>重试</button></div>}
    <section className="detail-heading"><div><p className="eyebrow">PROJECT / 项目详情</p><h1>{project.name}</h1><p className="subheading">{project.startDate} — {project.endDate}</p></div><button className="primary-button" onClick={() => void addTask()}>＋ 新建具体任务</button></section>
    <div className="detail-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">TEAM / 团队花名册</p><h2>团队成员</h2></div><span className="count">{members.length} 人</span></div>
        <form className="member-form" onSubmit={event => void saveMember(event)}><input aria-label="成员名称" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} placeholder="成员名称" required/><input aria-label="代表色" type="color" value={memberForm.color} onChange={e => setMemberForm({ ...memberForm, color: e.target.value })}/><button className="primary-button" type="submit">{editing ? '保存修改' : '添加成员'}</button>{editing && <button type="button" className="secondary-button" onClick={() => { setEditing(null); setMemberForm({ name: '', color: '#e76532' }); }}>取消</button>}</form>
        <div className="member-list">{members.length === 0 ? <p className="muted">还没有成员。先创建项目也可以，稍后再建立花名册。</p> : members.map(member => <div className="member-row" key={member.id}><span className="avatar" style={{ backgroundColor: member.color }}>{member.name.slice(0, 1)}</span><strong>{member.name}</strong><span className="member-color">{member.color}</span><button className="text-button" onClick={() => { setEditing(member.id); setMemberForm({ name: member.name, color: member.color }); }}>编辑</button><button className="text-button danger-text" onClick={() => void removeMember(member)}>删除</button></div>)}</div>
      </section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">WORK / 任务安排</p><h2>具体任务</h2></div><span className="count">负责人可选花名册成员</span></div>
        {tasks.length === 0 ? <div className="task-empty">还没有具体任务<br/><span>新建任务后即可指定负责人。</span></div> : <div className="task-list">{tasks.map(task => <div className="task-row" key={task.id}><input aria-label="任务名称" value={task.title} onChange={e => setTasks(current => current.map(item => item.id === task.id ? { ...item, title: e.target.value } : item))} onBlur={e => void updateTask(task, { title: e.target.value })}/><select aria-label={`${task.title} 状态`} value={task.status} onChange={e => void updateTask(task, { status: e.target.value })}><option value="not-started">未开始</option><option value="in-progress">进行中</option><option value="completed">已完成</option></select><select aria-label={`${task.title} 负责人`} value={task.assigneeId ?? ''} onChange={e => void updateTask(task, { assigneeId: e.target.value || null })}><option value="">未指派</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select><button className="text-button danger-text" onClick={async () => { if (window.confirm('确定删除这个具体任务吗？')) { await json(`/api/tasks/${task.id}`, { method: 'DELETE' }); await load(); } }}>删除</button></div>)}</div>}
      </section>
    </div>
    <footer>工地 <span>·</span> 团队信息与负责人分配会同步保存</footer>
  </main>;
}
