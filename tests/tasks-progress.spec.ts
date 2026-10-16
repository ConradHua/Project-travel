import { test, expect, type APIRequestContext } from '@playwright/test';
import { summarizeProgress } from '../client/src/lib/progress.js';

const apiBase = process.env.API_BASE ?? `http://localhost:${process.env.API_PORT ?? 3002}`;
type Project = { id: string; name: string; startDate: string; endDate: string };
type BigTask = { id: string; title: string; startDate: string; endDate: string; color: string };
type ConcreteTask = { id: string; bigTaskId: string; title: string; status: string; assigneeId: string | null };

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function createProject(request: APIRequestContext, name: string): Promise<Project> {
  const day = todayStr();
  const response = await request.post(`${apiBase}/api/projects`, {
    data: { name, startDate: day, endDate: day },
  });
  expect(response.ok()).toBeTruthy();
  return await response.json() as Project;
}

async function createBigTask(request: APIRequestContext, projectId: string, title?: string): Promise<BigTask> {
  const response = await request.post(`${apiBase}/api/projects/${projectId}/big-tasks`, { data: {} });
  expect(response.ok()).toBeTruthy();
  const bigTask = await response.json() as BigTask;
  if (!title) return bigTask;
  const patch = await request.patch(`${apiBase}/api/big-tasks/${bigTask.id}`, { data: { title } });
  expect(patch.ok()).toBeTruthy();
  return (await patch.json() as { task: BigTask }).task;
}

test.describe('具体任务与进度规则', () => {
  test('进度函数覆盖 0%、1–99 四舍五入与边界限制、100% 及各阶段映射', async () => {
    expect(summarizeProgress([])).toMatchObject({
      total: 0,
      notStarted: 0,
      inProgress: 0,
      completed: 0,
      percentage: 0,
      stage: 'empty',
      stageLabel: '空地',
    });

    expect(summarizeProgress([{ status: 'not-started' }, { status: 'in-progress' }])).toMatchObject({
      total: 2,
      notStarted: 1,
      inProgress: 1,
      completed: 0,
      percentage: 0,
      stage: 'empty',
      stageLabel: '空地',
    });

    // 1 / 300 = 0.33% -> clamped to 1% (地基)
    const oneOf300 = Array.from({ length: 300 }, (_, i) => ({ status: i === 0 ? 'completed' : 'not-started' }));
    expect(summarizeProgress(oneOf300)).toMatchObject({
      percentage: 1,
      stage: 'foundation',
      stageLabel: '地基',
    });

    // 24% -> 地基; 25% -> 框架
    const tasks24 = Array.from({ length: 100 }, (_, i) => ({ status: i < 24 ? 'completed' : 'not-started' }));
    expect(summarizeProgress(tasks24)).toMatchObject({ percentage: 24, stage: 'foundation', stageLabel: '地基' });

    const tasks25 = Array.from({ length: 4 }, (_, i) => ({ status: i === 0 ? 'completed' : 'in-progress' }));
    expect(summarizeProgress(tasks25)).toMatchObject({ percentage: 25, stage: 'frame', stageLabel: '框架' });

    // 49% -> 框架; 50% -> 墙体和屋顶
    const tasks49 = Array.from({ length: 100 }, (_, i) => ({ status: i < 49 ? 'completed' : 'not-started' }));
    expect(summarizeProgress(tasks49)).toMatchObject({ percentage: 49, stage: 'frame', stageLabel: '框架' });

    const tasks50 = [{ status: 'completed' }, { status: 'not-started' }];
    expect(summarizeProgress(tasks50)).toMatchObject({ percentage: 50, stage: 'walls-roof', stageLabel: '墙体和屋顶' });

    // 74% -> 墙体和屋顶; 75% -> 门窗装修
    const tasks74 = Array.from({ length: 100 }, (_, i) => ({ status: i < 74 ? 'completed' : 'not-started' }));
    expect(summarizeProgress(tasks74)).toMatchObject({ percentage: 74, stage: 'walls-roof', stageLabel: '墙体和屋顶' });

    const tasks75 = [{ status: 'completed' }, { status: 'completed' }, { status: 'completed' }, { status: 'in-progress' }];
    expect(summarizeProgress(tasks75)).toMatchObject({ percentage: 75, stage: 'finishing', stageLabel: '门窗装修' });

    // 199 / 200 = 99.5% -> rounded 100 but partial progress is clamped to 99% (门窗装修)
    const tasks199Of200 = Array.from({ length: 200 }, (_, i) => ({ status: i < 199 ? 'completed' : 'in-progress' }));
    expect(summarizeProgress(tasks199Of200)).toMatchObject({
      percentage: 99,
      stage: 'finishing',
      stageLabel: '门窗装修',
    });

    // All completed -> 100% (亮灯)
    expect(summarizeProgress([{ status: 'completed' }, { status: 'completed' }])).toMatchObject({
      percentage: 100,
      stage: 'completed',
      stageLabel: '亮灯',
    });
  });

  test('在大任务下添加具体任务默认未命名事项、未开始、未指派，支持状态切换、指派与取消指派、排序稳定与删除', async ({ page, request }) => {
    const stamp = Date.now();
    const project = await createProject(request, `任务验收-${stamp}`);
    let memberId: string | undefined;

    try {
      const memberRes = await request.post(`${apiBase}/api/members`, {
        data: { name: `陈工${stamp}`, color: '#2b6cb0' },
      });
      expect(memberRes.ok()).toBeTruthy();
      const member = await memberRes.json() as { id: string; name: string };
      memberId = member.id;

      await page.goto(`/projects/${project.id}`);

      // 初始无任务：0% 与空地，三个计数均为 0
      await expect(page.getByLabel('项目完成度')).toHaveText('0%');
      await expect(page.getByLabel('建造阶段')).toHaveText('空地');
      await expect(page.getByLabel('未开始计数')).toContainText('0');
      await expect(page.getByLabel('进行中计数')).toContainText('0');
      await expect(page.getByLabel('已完成计数')).toContainText('0');

      // 新建两个大任务（其中第二个保持为空大任务，验证空大任务不进入分母）
      const emptyBigTask = await createBigTask(request, project.id, '预留空大任务');
      expect(emptyBigTask.id).toBeTruthy();

      await page.getByRole('button', { name: '新建大任务' }).click();
      await expect(page.getByRole('heading', { name: '编辑排期' })).toBeVisible();

      // 在大任务面板下添加第一个具体任务：默认未命名事项、未开始、未指派
      await page.getByRole('button', { name: '添加具体任务' }).click();
      const taskInputs = page.getByLabel('任务名称');
      await expect(taskInputs).toHaveCount(1);
      await expect(taskInputs.first()).toHaveValue('未命名事项');
      await expect(page.getByLabel('未命名事项 状态')).toHaveValue('not-started');
      await expect(page.getByLabel('未命名事项 负责人')).toHaveValue('');

      await expect(page.getByLabel('未开始计数')).toContainText('1');
      await expect(page.getByLabel('项目完成度')).toHaveText('0%');
      await expect(page.getByLabel('建造阶段')).toHaveText('空地');

      // 修改第一个具体任务名称并再添加两个具体任务，验证按创建顺序稳定排列
      await taskInputs.first().fill('水电开槽');
      await taskInputs.first().press('Tab');

      await page.getByRole('button', { name: '添加具体任务' }).click();
      await taskInputs.nth(1).fill('管线铺设');
      await taskInputs.nth(1).press('Tab');

      await page.getByRole('button', { name: '添加具体任务' }).click();
      await taskInputs.nth(2).fill('封槽验收');
      await taskInputs.nth(2).press('Tab');

      await expect.poll(async () => {
        const count = await taskInputs.count();
        const values: string[] = [];
        for (let i = 0; i < count; i++) values.push(await taskInputs.nth(i).inputValue());
        return values;
      }).toEqual(['水电开槽', '管线铺设', '封槽验收']);

      // 选择与取消一位负责人
      const firstAssignee = page.getByLabel('水电开槽 负责人');
      await firstAssignee.selectOption(member.id);
      await expect(firstAssignee).toHaveValue(member.id);
      await firstAssignee.selectOption('');
      await expect(firstAssignee).toHaveValue('');
      await firstAssignee.selectOption(member.id);
      await expect(firstAssignee).toHaveValue(member.id);

      // 状态切换：将「管线铺设」设为进行中（进入分母但不进入分子，完成度仍为 0% 空地）
      await page.getByLabel('管线铺设 状态').selectOption('in-progress');
      await expect(page.getByLabel('未开始计数')).toContainText('2');
      await expect(page.getByLabel('进行中计数')).toContainText('1');
      await expect(page.getByLabel('已完成计数')).toContainText('0');
      await expect(page.getByLabel('项目完成度')).toHaveText('0%');
      await expect(page.getByLabel('建造阶段')).toHaveText('空地');

      // 将「水电开槽」设为完成：1/3 -> 33%（框架），且顺序保持不变
      await page.getByLabel('水电开槽 状态').selectOption('completed');
      await expect(page.getByLabel('未开始计数')).toContainText('1');
      await expect(page.getByLabel('进行中计数')).toContainText('1');
      await expect(page.getByLabel('已完成计数')).toContainText('1');
      await expect(page.getByLabel('项目完成度')).toHaveText('33%');
      await expect(page.getByLabel('建造阶段')).toHaveText('框架');

      // 刷新后验证创建顺序稳定不变
      await page.reload();
      await page.getByRole('button', { name: '选择大任务 未命名任务' }).click();
      await expect.poll(async () => {
        const inputs = page.getByLabel('任务名称');
        const count = await inputs.count();
        const values: string[] = [];
        for (let i = 0; i < count; i++) values.push(await inputs.nth(i).inputValue());
        return values;
      }).toEqual(['水电开槽', '管线铺设', '封槽验收']);

      // 接口拒绝跨大任务移动与无效负责人
      const detail = await (await request.get(`${apiBase}/api/projects/${project.id}/detail`)).json() as { tasks: ConcreteTask[] };
      const firstTask = detail.tasks[0];
      const moveRes = await request.patch(`${apiBase}/api/tasks/${firstTask.id}`, { data: { bigTaskId: emptyBigTask.id } });
      expect(moveRes.status()).toBe(400);
      const invalidAssigneeRes = await request.post(`${apiBase}/api/projects/${project.id}/tasks`, {
        data: { title: '非法负责人任务', bigTaskId: emptyBigTask.id, assigneeId: 'non-existent-member' },
      });
      expect(invalidAssigneeRes.status()).toBe(400);

      // 项目列表与项目页使用同一套进度规则：列表卡片同样展示 33%、框架及未开始 1 / 进行中 1 / 已完成 1
      await page.goto('/');
      const card = page.locator('.project-card').filter({ hasText: project.name });
      await expect(card).toContainText('33%');
      await expect(card).toContainText('框架');
      await expect(card.getByLabel(`${project.name} 状态计数`)).toContainText('未开始 1');
      await expect(card.getByLabel(`${project.name} 状态计数`)).toContainText('进行中 1');
      await expect(card.getByLabel(`${project.name} 状态计数`)).toContainText('已完成 1');

      // 回到项目页删除「封槽验收」，计数与完成度立即变为 1/2 = 50%（墙体和屋顶）
      await page.goto(`/projects/${project.id}`);
      await page.getByRole('button', { name: '选择大任务 未命名任务' }).click();
      page.once('dialog', dialog => dialog.accept());
      await page.locator('.task-row').nth(2).getByRole('button', { name: '删除' }).click();

      await expect(page.getByLabel('未开始计数')).toContainText('0');
      await expect(page.getByLabel('进行中计数')).toContainText('1');
      await expect(page.getByLabel('已完成计数')).toContainText('1');
      await expect(page.getByLabel('项目完成度')).toHaveText('50%');
      await expect(page.getByLabel('建造阶段')).toHaveText('墙体和屋顶');

      // 将「管线铺设」也设为完成：2/2 = 100%（亮灯）
      await page.getByLabel('管线铺设 状态').selectOption('completed');
      await expect(page.getByLabel('进行中计数')).toContainText('0');
      await expect(page.getByLabel('已完成计数')).toContainText('2');
      await expect(page.getByLabel('项目完成度')).toHaveText('100%');
      await expect(page.getByLabel('建造阶段')).toHaveText('亮灯');
    } finally {
      if (memberId) await request.delete(`${apiBase}/api/members/${memberId}`);
      await request.delete(`${apiBase}/api/projects/${project.id}`);
    }
  });

  test('浏览器验收覆盖 0%、1–24%、25–49%、50–74%、75–99%（含四舍五入上限 99%）与 100% 全部进度边界', async ({ page, request }) => {
    const project = await createProject(request, `边界验收-${Date.now()}`);
    try {
      const bigTask = await createBigTask(request, project.id, '主体工程');
      const created: ConcreteTask[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await request.post(`${apiBase}/api/big-tasks/${bigTask.id}/tasks`, {
          data: { title: `步骤${i + 1}` },
        });
        expect(res.ok()).toBeTruthy();
        created.push(await res.json() as ConcreteTask);
      }

      // 0/4 = 0% (空地)
      await page.goto(`/projects/${project.id}`);
      await expect(page.getByLabel('项目完成度')).toHaveText('0%');
      await expect(page.getByLabel('建造阶段')).toHaveText('空地');

      // 1/4 = 25% (框架); 再加 1 个未开始使 1/5 = 20% (地基)
      await page.getByLabel('步骤1 状态').selectOption('completed');
      await expect(page.getByLabel('项目完成度')).toHaveText('25%');
      await expect(page.getByLabel('建造阶段')).toHaveText('框架');

      const step5Res = await request.post(`${apiBase}/api/big-tasks/${bigTask.id}/tasks`, { data: { title: '步骤5' } });
      const step5 = await step5Res.json() as ConcreteTask;
      await page.reload();
      await expect(page.getByLabel('项目完成度')).toHaveText('20%');
      await expect(page.getByLabel('建造阶段')).toHaveText('地基');

      // 删除步骤5，回到 4 个任务：2/4 = 50% (墙体和屋顶)
      await request.delete(`${apiBase}/api/tasks/${step5.id}`);
      await page.reload();
      await page.getByLabel('步骤2 状态').selectOption('completed');
      await expect(page.getByLabel('项目完成度')).toHaveText('50%');
      await expect(page.getByLabel('建造阶段')).toHaveText('墙体和屋顶');

      // 3/4 = 75% (门窗装修)
      await page.getByLabel('步骤3 状态').selectOption('completed');
      await expect(page.getByLabel('项目完成度')).toHaveText('75%');
      await expect(page.getByLabel('建造阶段')).toHaveText('门窗装修');

      // 4/4 = 100% (亮灯)
      await page.getByLabel('步骤4 状态').selectOption('completed');
      await expect(page.getByLabel('项目完成度')).toHaveText('100%');
      await expect(page.getByLabel('建造阶段')).toHaveText('亮灯');

      // 补充 196 个已完成 + 1 个未开始：共 200 完成 / 201 总数 = 99.5% -> 浏览器四舍五入限制在 99%（门窗装修）
      for (let i = 5; i <= 200; i++) {
        await request.post(`${apiBase}/api/big-tasks/${bigTask.id}/tasks`, {
          data: { title: `步骤${i}`, status: 'completed' },
        });
      }
      await request.post(`${apiBase}/api/big-tasks/${bigTask.id}/tasks`, {
        data: { title: '步骤201', status: 'not-started' },
      });
      await page.reload();
      await expect(page.getByLabel('项目完成度')).toHaveText('99%');
      await expect(page.getByLabel('建造阶段')).toHaveText('门窗装修');
    } finally {
      await request.delete(`${apiBase}/api/projects/${project.id}`);
    }
  });
});
