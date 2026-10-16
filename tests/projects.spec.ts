import { test, expect } from '@playwright/test';

const apiBase = `http://localhost:${process.env.API_PORT ?? 3002}`;

test.beforeEach(async ({ request }) => {
  const projects = await (await request.get(`${apiBase}/api/projects`)).json() as { id: string }[];
  for (const project of projects) await request.delete(`${apiBase}/api/projects/${project.id}`);
});

test('项目创建默认日期、刷新恢复、取消删除与永久删除', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('这里还没有项目')).toBeVisible();
  await page.getByRole('button', { name: '创建第一个项目' }).click();
  const today = new Date();
  const end = new Date(today); end.setDate(end.getDate() + 30);
  const date = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  await expect(page.getByLabel('开工日')).toHaveValue(date(today));
  await expect(page.getByLabel('完工日')).toHaveValue(date(end));
  await page.getByLabel('项目名称').fill('浏览器验收项目');
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '浏览器验收项目' })).toBeVisible();
  await expect(page.getByText('0%', { exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '浏览器验收项目' })).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '删除项目 浏览器验收项目' }).click();
  await expect(page.getByRole('heading', { name: '浏览器验收项目' })).toBeVisible();
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('不可撤销'); await dialog.accept(); });
  await page.getByRole('button', { name: '删除项目 浏览器验收项目' }).click();
  await expect(page.getByText('这里还没有项目')).toBeVisible();
});
