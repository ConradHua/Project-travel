import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { summarizeProgress, type TaskStatus } from '../lib/progress';

type Member = { id: string; name: string; color: string };
type Project = { id: string; name: string; startDate: string; endDate: string };
type BigTask = { id: string; projectId: string; title: string; startDate: string; endDate: string; color: string };
type Task = { id: string; bigTaskId: string; title: string; status: TaskStatus; assigneeId: string | null; assigneeName?: string; assigneeColor?: string };
type DragState = { id: string; mode: 'move' | 'start' | 'end'; pointerId: number; originX: number; latestX: number; start: string; end: string; cellWidth: number };

async function json<T>(url: string, options?: RequestInit): Promise<T> { const response = await fetch(url, options); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? '操作失败，请重试。'); } return response.status === 204 ? undefined as T : response.json(); }
const dayMs = 86400000;
const parseDate = (value: string) => new Date(`${value}T00:00:00Z`);
const formatDate = (value: Date) => value.toISOString().slice(0, 10);
const addDays = (value: string, amount: number) => { const result = parseDate(value); result.setUTCDate(result.getUTCDate() + amount); return formatDate(result); };
const daysBetween = (start: string, end: string) => Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / dayMs);
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const monthKey = (value: string) => value.slice(0, 7);
const monthLabel = (value: string) => `${value.slice(0, 4)}年${value.slice(5, 7)}月`;
const monday = (value: string) => { const day = parseDate(value).getUTCDay(); return addDays(value, day === 0 ? -6 : 1 - day); };
const layoutTasks = (tasks: BigTask[]) => { const rows: BigTask[][] = []; return tasks.map(task => { let row = rows.findIndex(items => items.every(item => item.endDate < task.startDate || item.startDate > task.endDate)); if (row < 0) { row = rows.length; rows.push([]); } rows[row].push(task); return { task, row }; }); };

export function ProjectDetailPage({ id }: { id: string }) {
  const [project, setProject] = useState<Project>(); const [bigTasks, setBigTasks] = useState<BigTask[]>([]); const [tasks, setTasks] = useState<Task[]>([]); const [members, setMembers] = useState<Member[]>([]); const [selected, setSelected] = useState<string | null>(null); const [scale, setScale] = useState<'week' | 'month'>('week'); const [error, setError] = useState(''); const [retry, setRetry] = useState<(() => Promise<void>) | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', color: '#e76532' }); const [editingMember, setEditingMember] = useState<string | null>(null); const dragRef = useRef<DragState | null>(null); const timelineScrollRef = useRef<HTMLDivElement>(null); const todayRef = useRef<HTMLSpanElement>(null); const projectRef = useRef<Project | undefined>(undefined); const draftRef = useRef<Record<string, Partial<BigTask>>>({});
  const fail = (reason: unknown, again?: () => Promise<void>) => { setError(reason instanceof Error ? reason.message : '操作失败，请重试。'); setRetry(() => again ?? (async () => undefined)); };
  async function load() { try { const [detail, roster] = await Promise.all([json<{ project: Project; bigTasks: BigTask[]; tasks: Task[] }>(`/api/projects/${id}/detail`), json<Member[]>('/api/members')]); setProject(detail.project); setBigTasks(items => detail.bigTasks.map(remote => ({ ...remote, ...(draftRef.current[remote.id] ?? {}), ...(items.find(item => item.id === remote.id && dragRef.current?.id === remote.id) ?? {}) }))); setTasks(detail.tasks); setMembers(roster); setError(''); setRetry(null); } catch (e) { fail(e, load); } }
  useEffect(() => { void load(); }, [id]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => {
    if (scale !== 'week' || !project || daysBetween(project.startDate, project.endDate) <= 90) return;
    const container = timelineScrollRef.current;
    const target = todayRef.current;
    if (!container || !target) return;
    const targetLeft = target.offsetLeft - (container.clientWidth - target.offsetWidth) / 2;
    container.scrollLeft = Math.max(0, Math.min(targetLeft, container.scrollWidth - container.clientWidth));
  }, [scale, project?.id]);

  const timeline = useMemo(() => { if (!project) return { days: [], months: [], total: 1, start: '', end: '' }; const days = Array.from({ length: daysBetween(project.startDate, project.endDate) + 1 }, (_, index) => addDays(project.startDate, index)); const months = [...new Set(days.map(monthKey))]; return { days, months, total: days.length, start: project.startDate, end: project.endDate }; }, [project]);
  const rows = layoutTasks(bigTasks); const selectedTask = bigTasks.find(task => task.id === selected);
  const updateBigTask = async (task: BigTask, patch: Partial<BigTask>, fromRetry = false) => { const body = { ...patch }; draftRef.current[task.id] = { ...draftRef.current[task.id], ...body }; try { const result = await json<{ task: BigTask; project: Project }>(`/api/big-tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const pending = draftRef.current[task.id]; if (pending) { for (const key of Object.keys(body) as (keyof BigTask)[]) { if (pending[key] === body[key]) delete pending[key]; } if (!Object.keys(pending).length) delete draftRef.current[task.id]; } setBigTasks(items => items.map(item => { if (item.id !== task.id) return item; const draft = draftRef.current[task.id] ?? {}; return { ...result.task, ...draft }; })); setProject(result.project); if (fromRetry) { setError(''); setRetry(null); } } catch (e) { fail(e, () => updateBigTask(task, body, true)); } };
  const updateTask = async (task: Task, patch: Partial<Task>) => { try { const result = await json<Task>(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); setTasks(items => items.map(item => item.id === task.id ? result : item)); setError(''); } catch (e) { fail(e, () => updateTask(task, patch)); } };
  const createBigTask = async () => { try { const task = await json<BigTask>(`/api/projects/${id}/big-tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); setBigTasks(items => [...items, task]); setSelected(task.id); setError(''); } catch (e) { fail(e, createBigTask); } };
  const saveProjectDates = async (patch: Partial<Project>) => { const original = projectRef.current; try { const next = await json<Project>(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); setProject(next); setError(''); } catch (e) { if (original) setProject(original); fail(e, () => saveProjectDates(patch)); } };
  const beginDrag = (event: PointerEvent<HTMLElement>, task: BigTask, mode: DragState['mode']) => { if (scale === 'month') return; const cellWidth = 72; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { id: task.id, mode, pointerId: event.pointerId, originX: event.clientX, latestX: event.clientX, start: task.startDate, end: task.endDate, cellWidth }; };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => { const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; drag.latestX = event.clientX; const delta = Math.round((drag.latestX - drag.originX) / drag.cellWidth); let start = drag.start; let end = drag.end; if (drag.mode === 'move') { start = addDays(drag.start, delta); end = addDays(drag.end, delta); } else if (drag.mode === 'start') start = addDays(drag.start, delta); else end = addDays(drag.end, delta); if (drag.mode === 'start' && start > end) start = end; if (drag.mode === 'end' && end < start) end = start; setBigTasks(items => items.map(item => item.id === drag.id ? { ...item, startDate: start, endDate: end } : item)); };
  const finishDrag = (event?: PointerEvent<HTMLDivElement>, cancelled = false) => { const drag = dragRef.current; if (!drag || (event && event.pointerId !== drag.pointerId)) return; if (event && !cancelled) drag.latestX = event.clientX; const delta = cancelled ? 0 : Math.round((drag.latestX - drag.originX) / drag.cellWidth); let start = drag.start; let end = drag.end; if (drag.mode === 'move') { start = addDays(start, delta); end = addDays(end, delta); } else if (drag.mode === 'start') start = addDays(start, delta); else end = addDays(end, delta); if (drag.mode === 'start' && start > end) start = end; if (drag.mode === 'end' && end < start) end = start; const task = bigTasks.find(item => item.id === drag.id); dragRef.current = null; if (cancelled) { setBigTasks(items => items.map(item => item.id === drag.id ? { ...item, startDate: drag.start, endDate: drag.end } : item)); } else if (task && (start !== drag.start || end !== drag.end)) void updateBigTask(task, { startDate: start, endDate: end }); if (event?.currentTarget.hasPointerCapture(drag.pointerId)) event.currentTarget.releasePointerCapture(drag.pointerId); };

  async function saveMember(event: FormEvent) { event.preventDefault(); const payload = { ...memberForm }; const memberId = editingMember; const path = memberId ? `/api/members/${memberId}` : '/api/members'; const save = async () => { try { await json(path, { method: memberId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setMemberForm({ name: '', color: '#e76532' }); setEditingMember(null); await load(); } catch (e) { fail(e, save); } }; await save(); }
  const removeMember = async (member: Member) => { if (!window.confirm(`确定删除成员「${member.name}」吗？已分配给他的任务会保留，但负责人将变为未指派。`)) return; try { await json(`/api/members/${member.id}`, { method: 'DELETE' }); await load(); } catch (e) { fail(e, () => removeMember(member)); } };
  const deleteBigTask = async (task: BigTask) => { try { await json(`/api/big-tasks/${task.id}`, { method: 'DELETE' }); setBigTasks(items => items.filter(item => item.id !== task.id)); setTasks(items => items.filter(item => item.bigTaskId !== task.id)); setSelected(null); setError(''); setRetry(null); } catch (e) { fail(e, () => deleteBigTask(task)); } };
  const addConcreteTask = async (bigTaskId?: string) => {
    try {
      let parent = bigTasks.find(item => item.id === (bigTaskId ?? selected)) ?? bigTasks[0];
      if (!parent) {
        parent = await json<BigTask>(`/api/projects/${id}/big-tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        setBigTasks(items => [...items, parent!]);
        setSelected(parent.id);
      }
      const task = await json<Task>(`/api/big-tasks/${parent.id}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setTasks(items => [...items, task]);
      setError('');
    } catch (e) {
      fail(e, () => addConcreteTask(bigTaskId));
    }
  };
  const deleteConcreteTask = async (task: Task, confirmed = false) => {
    if (!confirmed && !window.confirm('确定删除这个具体任务吗？')) return;
    try {
      await json(`/api/tasks/${task.id}`, { method: 'DELETE' });
      setTasks(items => items.filter(item => item.id !== task.id));
      setError('');
    } catch (e) {
      fail(e, () => deleteConcreteTask(task, true));
    }
  };
  const progress = useMemo(() => summarizeProgress(tasks), [tasks]);
  if (!project) return <main className="shell"><div className="empty-state">正在读取项目…</div></main>;
  const daysInMonth = (key: string) => timeline.days.filter(day => monthKey(day) === key);
  const monthPosition = (day: string) => { const visibleDay = day < timeline.start ? timeline.start : day > timeline.end ? timeline.end : day; const key = monthKey(visibleDay); const index = Math.max(0, timeline.months.indexOf(key)); const first = timeline.days.find(item => monthKey(item) === key) ?? timeline.start; return index * 180 + daysBetween(first, visibleDay) / Math.max(1, daysInMonth(key).length) * 180; };
  const renderTaskRow = (task: Task) => {
    const parentTitle = bigTasks.find(item => item.id === task.bigTaskId)?.title ?? '大任务';
    return (
      <div className="task-row" key={task.id} data-task-id={task.id}>
        <span className="task-parent-tag" title="所属大任务">{parentTitle}</span>
        <input
          aria-label="任务名称"
          value={task.title}
          onChange={event => setTasks(items => items.map(item => item.id === task.id ? { ...item, title: event.target.value } : item))}
          onBlur={event => void updateTask(task, { title: event.target.value })}
        />
        <select aria-label={`${task.title} 状态`} value={task.status} onChange={event => void updateTask(task, { status: event.target.value as TaskStatus })}>
          <option value="not-started">未开始</option>
          <option value="in-progress">进行中</option>
          <option value="completed">完成</option>
        </select>
        <select aria-label={`${task.title} 负责人`} value={task.assigneeId ?? ''} onChange={event => void updateTask(task, { assigneeId: event.target.value || null })}>
          <option value="">未指派</option>
          {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <button type="button" className="text-button danger-text" onClick={() => void deleteConcreteTask(task)}>删除</button>
      </div>
    );
  };
  const selectedConcreteTasks = selectedTask ? tasks.filter(task => task.bigTaskId === selectedTask.id) : [];
  const remainingConcreteTasks = selectedTask ? tasks.filter(task => task.bigTaskId !== selectedTask.id) : tasks;
  return <main className="shell timeline-shell"><header className="topbar"><a className="brand" href="/" aria-label="工地首页"><span className="brand-mark" aria-hidden="true">工</span><span>工地</span></a><a className="back-link" href="/">返回项目</a></header>
    {error && <div role="alert" className="alert">{error}<button onClick={() => { const action = retry; setError(''); if (action) void action(); }}>重试</button></div>}
    <section className="detail-heading"><div><p className="eyebrow">项目详情</p><h1>{project.name}</h1><p className="subheading"><input aria-label="项目开工日" type="date" value={project.startDate} onChange={event => void saveProjectDates({ startDate: event.target.value })}/> — <input aria-label="项目完工日" type="date" value={project.endDate} onChange={event => void saveProjectDates({ endDate: event.target.value })}/></p></div><button className="primary-button" onClick={() => void createBigTask()}>＋ 新建大任务</button></section>
    <div className="timeline-toolbar"><div className="scale-switch"><button className={scale === 'week' ? 'active' : ''} onClick={() => setScale('week')}>周视图</button><button className={scale === 'month' ? 'active' : ''} onClick={() => setScale('month')}>月视图</button></div><span>{bigTasks.length} 个大任务 · 共 {progress.total} 项具体任务</span></div>
    <section className="timeline-layout"><div className="timeline-panel"><div className="timeline-scroll" ref={timelineScrollRef}><div className={`timeline ${scale}`} style={{ minWidth: scale === 'week' ? Math.max(760, timeline.total * 72) : Math.max(760, timeline.months.length * 180) }}>
      {scale === 'week' ? <><div className="week-groups">{[...new Set(timeline.days.map(monday))].map(week => <span key={week} style={{ width: `${timeline.days.filter(day => monday(day) === week).length * 72}px` }}>周起 {week.slice(5)}</span>)}</div><div className="timeline-header day-header">{timeline.days.map((day) => <span key={day} ref={day === (today() < timeline.start ? timeline.start : today() > timeline.end ? timeline.end : today()) ? todayRef : undefined}>{`${day.slice(5)} ${['日', '一', '二', '三', '四', '五', '六'][parseDate(day).getUTCDay()]}`}</span>)}</div></> : <div className="timeline-header month-header">{timeline.months.map(key => <span key={key}>{monthLabel(key)}<small>{daysInMonth(key).length} 天</small></span>)}</div>}
      <div className="timeline-body" style={{ minHeight: Math.max(210, rows.length * 58 + 34) }}>{rows.length === 0 && <p className="muted timeline-empty">还没有大任务，点击右上角开始排期。</p>}{rows.map(({ task, row }) => { const leftDays = daysBetween(timeline.start, task.startDate); const widthDays = daysBetween(task.startDate, task.endDate) + 1; const left = scale === 'week' ? leftDays * 72 : monthPosition(task.startDate); const endPosition = monthPosition(task.endDate) + 180 / Math.max(1, daysInMonth(monthKey(task.endDate)).length); const width = scale === 'week' ? widthDays * 72 : Math.max(1, endPosition - left); const subdued = !tasks.some(item => item.bigTaskId === task.id); return <div className={`big-task-bar ${subdued ? 'subdued' : ''} ${selected === task.id ? 'selected' : ''}`} key={task.id} style={{ left, width, top: row * 58 + 14, backgroundColor: task.color }} role="button" tabIndex={0} aria-label={`选择大任务 ${task.title}`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelected(task.id); }} onClick={() => setSelected(task.id)} onPointerDown={event => beginDrag(event, task, 'move')} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={event => finishDrag(event, true)}><button aria-label="调整开始日期" className="resize-handle left" onPointerDown={event => { event.stopPropagation(); beginDrag(event, task, 'start'); }}/><strong>{task.title}</strong><small>{task.startDate} — {task.endDate}</small><button aria-label="调整结束日期" className="resize-handle right" onPointerDown={event => { event.stopPropagation(); beginDrag(event, task, 'end'); }}/></div>; })}</div>
    </div></div></div><aside className={`task-editor ${selectedTask ? 'open' : ''}`}>{selectedTask ? <>
      <div className="editor-heading"><div><p className="eyebrow">大任务</p><h2>编辑排期</h2></div><button className="icon-button" aria-label="关闭编辑面板" onClick={() => setSelected(null)}>×</button></div>
      <label>标题<input value={selectedTask.title} onChange={event => { const title = event.target.value; draftRef.current[selectedTask.id] = { ...draftRef.current[selectedTask.id], title }; setBigTasks(items => items.map(item => item.id === selectedTask.id ? { ...item, title } : item)); }} onBlur={event => { const title = event.target.value; delete draftRef.current[selectedTask.id]?.title; void updateBigTask({ ...selectedTask, title }, { title }); }}/></label>
      <div className="editor-dates"><label>开始日期<input type="date" value={selectedTask.startDate} onChange={event => { const startDate = event.target.value; draftRef.current[selectedTask.id] = { ...draftRef.current[selectedTask.id], startDate }; setBigTasks(items => items.map(item => item.id === selectedTask.id ? { ...item, startDate } : item)); }} onBlur={event => { const startDate = event.target.value; delete draftRef.current[selectedTask.id]?.startDate; void updateBigTask({ ...selectedTask, startDate }, { startDate }); }}/></label><label>结束日期<input type="date" value={selectedTask.endDate} onChange={event => { const endDate = event.target.value; draftRef.current[selectedTask.id] = { ...draftRef.current[selectedTask.id], endDate }; setBigTasks(items => items.map(item => item.id === selectedTask.id ? { ...item, endDate } : item)); }} onBlur={event => { const endDate = event.target.value; delete draftRef.current[selectedTask.id]?.endDate; void updateBigTask({ ...selectedTask, endDate }, { endDate }); }}/></label></div>
      <label>区分色<input type="color" value={selectedTask.color} onChange={event => { const color = event.target.value; setBigTasks(items => items.map(item => item.id === selectedTask.id ? { ...item, color } : item)); void updateBigTask(selectedTask, { color }); }}/></label>
      <div className="editor-concrete-section">
        <div className="editor-concrete-header">
          <span>具体任务（{selectedConcreteTasks.length}）</span>
          <button type="button" className="secondary-button" onClick={() => void addConcreteTask(selectedTask.id)}>＋ 添加具体任务</button>
        </div>
        {selectedConcreteTasks.length === 0 ? <p className="muted">当前大任务下还没有具体任务。</p> : <div className="task-list">{selectedConcreteTasks.map(renderTaskRow)}</div>}
      </div>
      <button className="danger-button" onClick={() => { if (window.confirm('确定永久删除这个大任务吗？其中的具体任务也会一并删除。')) void deleteBigTask(selectedTask); }}>永久删除大任务</button>
    </> : <div className="editor-empty"><p>选择时间轴上的大任务</p><span>标题、日期和区分色会在编辑后保存。</span></div>}</aside></section>
    <section className="panel site-panel" aria-label="工地进度">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">工地</p>
          <h2>工地进度</h2>
        </div>
        <div className="site-summary">
          <span className="site-stage-badge" data-stage={progress.stage} aria-label="建造阶段">{progress.stageLabel}</span>
          <strong className="site-percentage" aria-label="项目完成度">{progress.percentage}%</strong>
        </div>
      </div>
      <div className="progress-track site-progress-track"><span style={{ width: `${progress.percentage}%` }}/></div>
      <div className="status-counts" aria-label="任务状态计数">
        <div className="status-count-card" aria-label="未开始计数"><span>未开始</span><strong>{progress.notStarted}</strong></div>
        <div className="status-count-card" aria-label="进行中计数"><span>进行中</span><strong>{progress.inProgress}</strong></div>
        <div className="status-count-card" aria-label="已完成计数"><span>已完成</span><strong>{progress.completed}</strong></div>
      </div>
    </section>
    <section className="panel team-panel"><div className="panel-heading"><div><p className="eyebrow">团队花名册</p><h2>团队成员</h2></div><span className="count">{members.length} 人</span></div><form className="member-form" onSubmit={event => void saveMember(event)}><input aria-label="成员名称" value={memberForm.name} onChange={event => setMemberForm({ ...memberForm, name: event.target.value })} placeholder="成员名称" required/><input aria-label="代表色" type="color" value={memberForm.color} onChange={event => setMemberForm({ ...memberForm, color: event.target.value })}/><button className="primary-button" type="submit">{editingMember ? '保存修改' : '添加成员'}</button>{editingMember && <button type="button" className="secondary-button" onClick={() => { setEditingMember(null); setMemberForm({ name: '', color: '#e76532' }); }}>取消</button>}</form><button className="secondary-button" onClick={() => void addConcreteTask()}>＋ 新建具体任务</button><div className="member-list">{members.length === 0 ? <p className="muted">还没有成员。先创建项目也可以，稍后再建立花名册。</p> : members.map(member => <div className="member-row" key={member.id}><span className="avatar" style={{ backgroundColor: member.color }}>{member.name.slice(0, 1)}</span><strong>{member.name}</strong><span className="member-color">{member.color}</span><button className="text-button" onClick={() => { setEditingMember(member.id); setMemberForm({ name: member.name, color: member.color }); }}>编辑</button><button className="text-button danger-text" onClick={() => void removeMember(member)}>删除</button></div>)}</div><div className="concrete-tasks"><div className="panel-heading"><div><p className="eyebrow">任务安排</p><h2>具体任务</h2></div><span className="count">按创建顺序排列 · 负责人可选花名册成员</span></div>{tasks.length === 0 ? <div className="task-empty">还没有具体任务<br/><span>新建任务后即可指定负责人。</span></div> : remainingConcreteTasks.length === 0 ? <p className="muted">当前具体任务已在上方大任务编辑面板中展示。</p> : <div className="task-list">{remainingConcreteTasks.map(renderTaskRow)}</div>}</div></section><footer>工地 <span>·</span> 大任务排期会自动保存</footer></main>;
}
