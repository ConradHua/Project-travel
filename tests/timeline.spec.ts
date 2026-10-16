import { test, expect, type APIRequestContext, type Locator } from '@playwright/test';

const apiBase = process.env.API_BASE ?? `http://localhost:${process.env.API_PORT ?? 3001}`;
type Project = { id: string; name: string; startDate: string; endDate: string };
type BigTask = { id: string; title: string; startDate: string; endDate: string; color: string };

function dateAt(offset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function createProject(request: APIRequestContext, name: string, start = dateAt(-30), end = dateAt(30)) {
  const response = await request.post(`${apiBase}/api/projects`, { data: { name, startDate: start, endDate: end } });
  expect(response.ok()).toBeTruthy();
  return await response.json() as Project;
}

async function createBigTask(request: APIRequestContext, projectId: string, patch: Partial<BigTask> = {}) {
  const response = await request.post(`${apiBase}/api/projects/${projectId}/big-tasks`, { data: {} });
  expect(response.ok()).toBeTruthy();
  const task = await response.json() as BigTask;
  if (!Object.keys(patch).length) return task;
  const update = await request.patch(`${apiBase}/api/big-tasks/${task.id}`, { data: patch });
  expect(update.ok()).toBeTruthy();
  return (await update.json() as { task: BigTask }).task;
}

async function projectDetail(request: APIRequestContext, projectId: string) {
  const response = await request.get(`${apiBase}/api/projects/${projectId}/detail`);
  expect(response.ok()).toBeTruthy();
  return await response.json() as { project: Project; bigTasks: BigTask[] };
}

async function drag(locator: Locator, fromX: number, toX: number) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('拖动目标不可见');
  const y = box.y + box.height / 2;
  const page = locator.page();
  await page.mouse.move(box.x + fromX, y);
  await page.mouse.down();
  await page.mouse.move(box.x + toX, y, { steps: 4 });
  await page.mouse.up();
}

test.describe('大任务时间轴', () => {
  let project: Project;

  test.beforeEach(async ({ request }) => {
    project = await createProject(request, `时间轴验收-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  });

  test.afterEach(async ({ request }) => {
    const response = await request.delete(`${apiBase}/api/projects/${project.id}`);
    expect([204, 404]).toContain(response.status());
  });

  test('创建默认大任务限制为今天至七天后，并打开编辑器', async ({ page, request }) => {
    await page.goto(`/projects/${project.id}`);
    await page.getByRole('button', { name: '新建大任务' }).click();
    await expect(page.getByRole('heading', { name: '编辑排期' })).toBeVisible();
    await expect(page.getByLabel('标题')).toHaveValue('未命名任务');
    await expect(page.getByRole('textbox', { name: '开始日期' })).toHaveValue(dateAt(0));
    await expect(page.getByLabel('结束日期', { exact: true })).toHaveValue(dateAt(7));
    const detail = await projectDetail(request, project.id);
    expect(detail.bigTasks[0]).toMatchObject({ startDate: dateAt(0), endDate: dateAt(7) });
  });

  test('项目较短时将默认日期限制在项目工期内', async ({ page, request }) => {
    await request.patch(`${apiBase}/api/projects/${project.id}`, { data: { startDate: dateAt(2), endDate: dateAt(4) } });
    await page.goto(`/projects/${project.id}`);
    await page.getByRole('button', { name: '新建大任务' }).click();
    await expect(page.getByRole('textbox', { name: '开始日期' })).toHaveValue(dateAt(2));
    await expect(page.getByLabel('结束日期', { exact: true })).toHaveValue(dateAt(4));
    await expect(page.getByText(`${dateAt(2)} — ${dateAt(4)}`, { exact: true })).toBeVisible();
    expect((await projectDetail(request, project.id)).bigTasks[0]).toMatchObject({ startDate: dateAt(2), endDate: dateAt(4) });
  });

  test('标题、颜色和日期在失焦后持久化，Escape 关闭选择', async ({ page, request }) => {
    await page.goto(`/projects/${project.id}`);
    await page.getByRole('button', { name: '新建大任务' }).click();
    await page.getByLabel('标题').fill('基础施工');
    await page.getByLabel('标题').press('Tab');
    await page.getByRole('textbox', { name: '开始日期' }).fill(dateAt(1));
    await page.getByRole('textbox', { name: '开始日期' }).press('Tab');
    await page.getByLabel('结束日期', { exact: true }).fill(dateAt(8));
    await page.getByLabel('结束日期', { exact: true }).press('Tab');
    await page.getByLabel('区分色').fill('#336699');
    await expect.poll(async () => (await projectDetail(request, project.id)).bigTasks[0]).toMatchObject({ title: '基础施工', startDate: dateAt(1), endDate: dateAt(8), color: '#336699' });
    await page.keyboard.press('Escape');
    await expect(page.getByText('选择时间轴上的大任务')).toBeVisible();
  });

  test('切换月份不改变日期，且月视图不响应拖动', async ({ page, request }) => {
    const task = await createBigTask(request, project.id, { title: '跨月任务', startDate: dateAt(3), endDate: dateAt(6) });
    await page.goto(`/projects/${project.id}`);
    await page.getByRole('button', { name: '月视图' }).click();
    await expect(page.getByText('跨月任务', { exact: true })).toBeVisible();
    const bar = page.getByRole('button', { name: '选择大任务 跨月任务' });
    await drag(bar, 40, 200);
    expect((await projectDetail(request, project.id)).bigTasks.find(item => item.id === task.id)).toMatchObject({ startDate: dateAt(3), endDate: dateAt(6) });
  });

  test('周视图拖动按天吸附，并支持两端调整和至少一天', async ({ page, request }) => {
    const task = await createBigTask(request, project.id, { title: '可调整任务', startDate: dateAt(3), endDate: dateAt(5) });
    await page.goto(`/projects/${project.id}`);
    const bar = page.getByRole('button', { name: '选择大任务 可调整任务' });
    await drag(bar, 100, 172);
    await expect.poll(async () => (await projectDetail(request, project.id)).bigTasks.find(item => item.id === task.id)?.startDate).toBe(dateAt(4));
    const resized = page.getByRole('button', { name: '选择大任务 可调整任务' });
    await drag(resized.getByRole('button', { name: '调整结束日期' }), 6, -140);
    await expect.poll(async () => (await projectDetail(request, project.id)).bigTasks.find(item => item.id === task.id)).toMatchObject({ startDate: dateAt(4), endDate: dateAt(4) });
    await drag(resized.getByRole('button', { name: '调整开始日期' }), 6, 150);
    await expect.poll(async () => (await projectDetail(request, project.id)).bigTasks.find(item => item.id === task.id)).toMatchObject({ startDate: dateAt(4), endDate: dateAt(4) });
  });

  test('重叠大任务分行，窄窗口可横向滚动，长项目初始定位今天附近', async ({ page, request }) => {
    await request.patch(`${apiBase}/api/projects/${project.id}`, { data: { startDate: dateAt(-90), endDate: dateAt(120) } });
    await createBigTask(request, project.id, { title: '任务甲', startDate: dateAt(0), endDate: dateAt(4) });
    await createBigTask(request, project.id, { title: '任务乙', startDate: dateAt(2), endDate: dateAt(6) });
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto(`/projects/${project.id}`);
    const scroll = page.locator('.timeline-scroll');
    expect(await scroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBeTruthy();
    const first = page.getByRole('button', { name: '选择大任务 任务甲' });
    const second = page.getByRole('button', { name: '选择大任务 任务乙' });
    expect(await first.evaluate(element => (element as HTMLElement).offsetTop)).not.toBe(await second.evaluate(element => (element as HTMLElement).offsetTop));
    const todayHeader = page.getByText(new RegExp(`${dateAt(0).slice(5)} `)).first();
    await expect(todayHeader).toBeVisible();
    await expect.poll(async () => await scroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  });

  test('保存失败保留编辑值并支持重试，删除失败也可重试并级联删除', async ({ page, request }) => {
    const task = await createBigTask(request, project.id);
    await request.post(`${apiBase}/api/projects/${project.id}/tasks`, { data: { title: '随大任务删除', bigTaskId: task.id } });
    await page.goto(`/projects/${project.id}`);
    await page.getByRole('button', { name: '选择大任务 未命名任务' }).click();
    await page.route(`**/api/big-tasks/${task.id}`, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '服务暂不可用' }) }));
    await page.getByLabel('标题', { exact: true }).fill('待重试排期');
    await page.getByLabel('标题', { exact: true }).press('Tab');
    await expect(page.getByRole('alert')).toContainText('服务暂不可用');
    await expect(page.getByLabel('标题', { exact: true })).toHaveValue('待重试排期');
    await page.unroute(`**/api/big-tasks/${task.id}`);
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect.poll(async () => (await projectDetail(request, project.id)).bigTasks[0].title).toBe('待重试排期');
    await page.route(`**/api/big-tasks/${task.id}`, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '删除暂不可用' }) }));
    page.once('dialog', async dialog => { expect(dialog.message()).toContain('具体任务也会一并删除'); await dialog.accept(); });
    await page.getByRole('button', { name: '永久删除大任务' }).click();
    await expect(page.getByRole('alert')).toContainText('删除暂不可用');
    await page.unroute(`**/api/big-tasks/${task.id}`);
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect.poll(async () => (await projectDetail(request, project.id)).bigTasks.length).toBe(0);
    const detail = await (await request.get(`${apiBase}/api/projects/${project.id}/detail`)).json();
    expect(detail.tasks).toEqual([]);
    await expect(page.getByText('选择时间轴上的大任务')).toBeVisible();
  });

  test('未来和过去项目独立限制默认起止日期', async ({ request }) => {
    for (const [start, end, expectedStart, expectedEnd] of [[-9, -2, -2, -2], [3, 20, 3, 7], [12, 20, 12, 12]]) {
      const response = await request.patch(`${apiBase}/api/projects/${project.id}`, { data: { startDate: dateAt(start), endDate: dateAt(end) } });
      expect(response.ok()).toBeTruthy();
      const task = await createBigTask(request, project.id);
      expect(task).toMatchObject({ startDate: dateAt(expectedStart), endDate: dateAt(expectedEnd) });
      expect((await request.delete(`${apiBase}/api/big-tasks/${task.id}`)).status()).toBe(204);
    }
  });

  test('任务移出项目自动延长，向内移动不缩短，手动排除已有任务会拒绝', async ({ page, request }) => {
    await request.patch(`${apiBase}/api/projects/${project.id}`, { data: { startDate: dateAt(0) } });
    const task = await createBigTask(request, project.id, { title: '边界任务', startDate: dateAt(0), endDate: dateAt(2) });
    await page.goto(`/projects/${project.id}`);
    await drag(page.getByRole('button', { name: '选择大任务 边界任务' }), 40, -32);
    await expect.poll(async () => (await projectDetail(request, project.id)).project.startDate).toBe(dateAt(-1));
    await page.getByLabel('项目开工日').fill(dateAt(0));
    await page.getByLabel('项目开工日').press('Tab');
    await expect(page.getByRole('alert')).toContainText('不能缩短项目工期');
    await page.reload();
    await page.getByRole('button', { name: '选择大任务 边界任务' }).click();
    await page.getByRole('textbox', { name: '开始日期' }).fill(dateAt(0));
    await page.getByRole('textbox', { name: '开始日期' }).press('Tab');
    await expect.poll(async () => (await projectDetail(request, project.id)).project.startDate).toBe(dateAt(-1));
    expect(task.id).toBeTruthy();
  });
});
