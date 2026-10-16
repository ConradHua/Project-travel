import { test, expect } from '@playwright/test';

test('团队成员创建、编辑、指派与删除后取消指派', async ({ page }) => {
  const stamp = Date.now();
  const projectName = `团队验收项目${stamp}`;
  const memberName = `小林${stamp}`;
  await page.goto('/');
  await page.getByRole('button', { name: '创建第一个项目' }).click();
  await page.getByLabel('项目名称').fill(projectName);
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByRole('link', { name: projectName }).click();

  await page.getByLabel('成员名称').fill(memberName);
  await page.getByRole('button', { name: '添加成员' }).click();
  await expect(page.getByText(memberName, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新建具体任务' }).click();
  const assignee = page.getByLabel('新具体任务 负责人');
  await assignee.selectOption({ label: memberName });
  await expect(assignee).toHaveValue(/.+/);

  await page.getByRole('button', { name: '编辑' }).click();
  const editedName = `${memberName}（项目负责人）`;
  await page.getByLabel('成员名称').fill(editedName);
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByText(editedName, { exact: true })).toBeVisible();
  await expect(page.getByLabel('新具体任务 负责人')).toHaveValue(/.+/);

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByLabel('新具体任务 负责人')).toHaveValue('');
});
