import { FormEvent, useEffect, useMemo, useState } from 'react';

type Project = { id: string; name: string; startDate: string; endDate: string; createdAt: string };
const dateInputValue = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const today = () => dateInputValue(new Date());
const after30Days = () => { const date = new Date(); date.setDate(date.getDate() + 30); return dateInputValue(date); };

export function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('项目列表暂时无法读取。');
      setProjects(await response.json() as Project[]);
      setError('');
    } catch { setError('无法连接工地服务，请确认服务已启动后重试。'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!creating) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setCreating(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [creating]);
  const ordered = useMemo(() => projects, [projects]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.get('name'), startDate: form.get('startDate'), endDate: form.get('endDate') }) });
      if (!response.ok) { const result = await response.json() as { error?: string }; setError(result.error ?? '项目创建失败，请重试。'); return; }
      setCreating(false);
      await load();
    } catch { setError('无法连接工地服务，项目尚未创建，请检查连接后重试。'); }
  }

  async function deleteProject(project: Project) {
    if (!window.confirm(`确定永久删除项目「${project.name}」吗？此操作不可撤销。`)) return;
    const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    if (!response.ok) { setError('项目删除失败，请重试。'); return; }
    await load();
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="/" aria-label="工地首页"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M4 15 16 5l12 10v13H4z"/><path d="M12 28V18h8v10M3 15h26"/></svg></span><span>工地</span></a><div className="topbar-right"><span className="live-dot"/>本地项目空间</div></header>
    <section className="heading"><div><p className="eyebrow">PROJECTS / 项目总览</p><h1>项目</h1><p className="subheading">把每一个计划，变成看得见的进度。</p></div><button className="primary-button" onClick={() => setCreating(true)}><span aria-hidden="true">＋</span> 新建项目</button></section>
    {error && <div role="alert" className="alert">{error}<button onClick={() => void load()}>重试</button></div>}
    {busy ? <div className="empty-state">正在读取项目…</div> : ordered.length === 0 ? <section className="empty-state"><div className="empty-illustration" aria-hidden="true"><svg viewBox="0 0 240 150"><path className="ground" d="M26 119h188"/><path className="house-line" d="m76 81 44-36 44 36v38H76zM109 119V91h22v28M68 82l52-43 52 43"/><path className="sun" d="M192 39v17m-8-9h17m-14-6 12 12m0-12-12 12"/></svg></div><h2>这里还没有项目</h2><p>创建第一个项目，开始安排工地进度。</p><button className="primary-button" onClick={() => setCreating(true)}>＋ 创建第一个项目</button></section> : <section className="project-grid" aria-label="项目列表">{ordered.map(project => <article className="project-card" key={project.id}><div className="card-top"><span className="project-label">项目</span><button className="icon-button danger" title="删除项目" aria-label={`删除项目 ${project.name}`} onClick={() => void deleteProject(project)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button></div><h2><a className="project-link" href={`/projects/${project.id}`}>{project.name}</a></h2><p className="dates"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>{project.startDate} <span>—</span> {project.endDate}</p><div className="card-divider"/><div className="progress-row"><div className="mini-house" aria-hidden="true"><svg viewBox="0 0 64 52"><path d="m7 24 25-19 25 19v23H7z"/><path d="M25 47V31h14v16M4 24 32 3l28 21"/><path className="window" d="M14 29h6v7h-6zm24 0h6v7h-6z"/></svg></div><div className="progress-copy"><span>项目进度</span><strong>0%</strong></div><div className="progress-track"><span/></div></div></article>)}</section>}
    {creating && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCreating(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><p className="eyebrow">NEW PROJECT / 新建</p><h2 id="modal-title">创建项目</h2></div><button className="icon-button" aria-label="关闭" onClick={() => setCreating(false)}>×</button></div><form onSubmit={event => void createProject(event)}><label>项目名称<input autoFocus name="name" required maxLength={100} placeholder="例如：阳光花园改造"/></label><div className="date-fields"><label>开工日<input name="startDate" type="date" required defaultValue={today()}/></label><label>完工日<input name="endDate" type="date" required min={today()} defaultValue={after30Days()}/></label></div><p className="form-note">日期默认从今天起 30 天。</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setCreating(false)}>取消</button><button type="submit" className="primary-button">创建项目</button></div></form></section></div>}
    <footer>工地 <span>·</span> 所有项目数据保存在此设备</footer>
  </main>;
}
