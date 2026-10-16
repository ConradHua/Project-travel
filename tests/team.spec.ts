import { test, expect } from '@playwright/test';

const apiBase = `http://localhost:${process.env.API_PORT ?? 3002}`;

test('团队成员创建、编辑、指派与删除后取消指派', async ({ page, request }) => {
  const stamp = Date.now();
  const memberName = `小林${stamp}`;
  const today = new Date().toISOString().slice(0, 10);
  const response = await request.post(`${apiBase}/api/projects`, { data: { name: `团队验收项目${stamp}`, startDate: today, endDate: today } });
  expect(response.ok()).toBeTruthy();
  const project = await response.json() as { id: string };
  let memberId: string | undefined;
  try {
    await page.goto(`/projects/${project.id}`);
    await page.getByLabel('成员名称').fill(memberName);
    await page.getByRole('button', { name: '添加成员' }).click();
    const row = page.locator('.member-row').filter({ hasText: memberName });
    await expect(row).toBeVisible();
    await page.getByRole('button', { name: '新建具体任务' }).click();
    const assignee = page.getByLabel('新具体任务 负责人');
    await assignee.selectOption({ label: memberName });
    await expect(assignee).toHaveValue(/.+/);
    memberId = await assignee.inputValue();
    await row.getByRole('button', { name: '编辑', exact: true }).click();
    const editedName = `${memberName}（项目负责人）`;
    await page.getByLabel('成员名称').fill(editedName);
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.locator('.member-row').filter({ hasText: editedName })).toBeVisible();
    await expect(assignee).toHaveValue(memberId);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.member-row').filter({ hasText: editedName }).getByRole('button', { name: '删除', exact: true }).click();
    await expect(assignee).toHaveValue('');
  } finally {
    if (memberId) await request.delete(`${apiBase}/api/members/${memberId}`);
    await request.delete(`${apiBase}/api/projects/${project.id}`);
  }
});
