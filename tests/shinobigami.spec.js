const { test, expect } = require('./helpers/fixtures');

test('秘密管理マトリクスが開ける', async ({ page }) => {
  await page.goto('/シノビガミ秘密管理.html');

  await expect(page.getByText('秘密管理マトリクス')).toBeVisible();
});