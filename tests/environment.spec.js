const {test, expect} = require('./helpers/fixtures');
const {clickMatrixCell, dragSecret} = require('./helpers/canvas');
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('shinobigami_secret_matrix_v1')));
test('localhostで入力・Canvasクリック・ドラッグ・再読込', async ({page}, testInfo) => {
  const response=await page.goto('/シノビガミ秘密管理_v8_test.html');
  expect(response.status()).toBe(200);
  expect(new URL(page.url()).hostname).toBe('127.0.0.1');
  await expect(page.getByText('秘密管理マトリクス', {exact:true})).toBeVisible();
  for (const name of ['E2E秘密A', 'E2E秘密B']) {
    await page.locator('#newSecret').fill(name);
    await page.getByRole('button',{name:'秘密を追加',exact:true}).click();
  }
  await clickMatrixCell(page,1,'E2E秘密A');
  expect((await state(page)).matrix.PC2['E2E秘密A']).toBe(true);
  await dragSecret(page,'E2E秘密A','E2E秘密B');
  const after=await state(page);
  expect(after.secrets.indexOf('E2E秘密A')).toBeGreaterThan(after.secrets.indexOf('E2E秘密B'));
  await page.reload();
  expect((await state(page)).matrix.PC2['E2E秘密A']).toBe(true);
  await testInfo.attach('canvas-after', {body:await page.locator('#matrixCanvas').screenshot(),contentType:'image/png'});
});
