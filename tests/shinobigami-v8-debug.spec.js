const { test, expect } = require('./helpers/fixtures');
const path = require('path');
const fs = require('fs');
const { clickMatrixCell, dragSecret } = require('./helpers/canvas');

const APP_PATH = path.resolve(__dirname, '..', 'シノビガミ秘密管理_v8_test.html');
const APP_URL = '/シノビガミ秘密管理_v8_test.html';

async function openFresh(page) {
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText('秘密管理マトリクス')).toBeVisible();
}

async function getState(page) {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('shinobigami_secret_matrix_v1');
    return raw ? JSON.parse(raw) : null;
  });
}

async function selectSecret(page, text) {
  await page.locator('#secretSelect').selectOption({ label: text });
}

async function addSecret(page, name) {
  await page.locator('#newSecret').fill(name);
  await page.getByRole('button', { name: '秘密を追加' }).click();
}

async function addOneWayEmotion(page, from, to) {
  await page.locator('#emotionFrom').selectOption(from);
  await page.locator('#emotionTo').selectOption(to);
  await page.locator('#mutualEmotion').uncheck();

  await page.locator('#emotionPositive1').selectOption({
    label: '友情（＋）'
  });

  await page.getByRole('button', { name: '感情を登録' }).click();
}

test.describe('シノビガミ秘密管理 v8 デバッグ', () => {

  test('基本画面と初期状態', async ({ page }) => {
    await openFresh(page);

    await expect(page.getByText('秘密を追加・管理')).toBeVisible();
    await expect(page.getByText('感情を管理')).toBeVisible();
    await expect(page.getByText('画像タイトル')).toBeVisible();
    await expect(page.getByPlaceholder('秘密の名前')).toBeVisible();

    const state = await getState(page);

    expect(state.playerCount).toBe(6);
    expect(state.secrets).toHaveLength(6);
    expect(state.autoShareKnowledge).toBe(true);
  });

  test('秘密を追加すると入力欄と全体公開チェックが初期化される', async ({ page }) => {
    await openFresh(page);

    await page.locator('#newSecret').fill('テスト秘密');
    await page.locator('#newSecretPublic').check();
    await page.getByRole('button', { name: '秘密を追加' }).click();

    await expect(page.locator('#secretSelect option[value="テスト秘密"]')).toHaveCount(1);
    await expect(page.locator('#newSecret')).toHaveValue('');
    await expect(page.locator('#newSecretPublic')).not.toBeChecked();

    const state = await getState(page);
    expect(state.secrets).toContain('テスト秘密');
    expect(state.publicSecrets).toContain('テスト秘密');
  });

  test('PC名を入力中に秘密を追加しても入力中の名前が消えない', async ({ page }) => {
    await openFresh(page);

    const pc1 = page.locator('#pcInputs input[data-player-id="PC1"]');
    await pc1.fill('アリス');

    await addSecret(page, '入力保持テスト');

    await expect(page.locator('#pcInputs input[data-player-id="PC1"]')).toHaveValue('アリス');

    const state = await getState(page);
    expect(state.playerNames.PC1).toBe('PC1');
  });

  test('PC名を反映すると正式なPC名として保存されUndoできる', async ({ page }) => {
    await openFresh(page);

    await page.locator('#pcInputs input[data-player-id="PC1"]').fill('アリス');
    await page.getByRole('button', { name: 'PC名を反映' }).click();

    let state = await getState(page);
    expect(state.playerNames.PC1).toBe('アリス');

    await page.getByRole('button', { name: 'Undo' }).click();

    state = await getState(page);
    expect(state.playerNames.PC1).toBe('PC1');

    await page.getByRole('button', { name: 'Redo' }).click();

    state = await getState(page);
    expect(state.playerNames.PC1).toBe('アリス');
  });

  test('全体公開とUndo/Redo', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, '公開テスト');
    await selectSecret(page, '公開テスト');

    await page.getByRole('button', { name: '全体公開', exact: true }).click();

    let state = await getState(page);

    for (const pc of ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6']) {
      expect(state.matrix[pc]['公開テスト']).toBe(true);
    }

    await page.getByRole('button', { name: 'Undo' }).click();

    state = await getState(page);

    for (const pc of ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6']) {
      expect(state.matrix[pc]['公開テスト']).toBe(false);
    }

    await page.getByRole('button', { name: 'Redo' }).click();

    state = await getState(page);

    for (const pc of ['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6']) {
      expect(state.matrix[pc]['公開テスト']).toBe(true);
    }
  });

  test('秘密名変更とUndo', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, '変更前');

    await selectSecret(page, '変更前');

    page.once('dialog', dialog => dialog.accept('変更後'));
    await page.getByRole('button', { name: '名前を変更' }).click();

    let state = await getState(page);
    expect(state.secrets).toContain('変更後');
    expect(state.secrets).not.toContain('変更前');

    await page.getByRole('button', { name: 'Undo' }).click();

    state = await getState(page);
    expect(state.secrets).toContain('変更前');
    expect(state.secrets).not.toContain('変更後');
  });

  test('秘密削除とUndo', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, '削除テスト');
    await selectSecret(page, '削除テスト');

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '削除' }).click();

    let state = await getState(page);
    expect(state.secrets).not.toContain('削除テスト');

    await page.getByRole('button', { name: 'Undo' }).click();

    state = await getState(page);
    expect(state.secrets).toContain('削除テスト');
  });

  test('秘密の左移動・右移動とUndo', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, '移動テスト');

    let state = await getState(page);
    const originalIndex = state.secrets.indexOf('移動テスト');

    await selectSecret(page, '移動テスト');
    await page.getByRole('button', { name: '左へ' }).click();

    state = await getState(page);
    expect(state.secrets.indexOf('移動テスト')).toBe(originalIndex - 1);

    await page.getByRole('button', { name: '右へ' }).click();

    state = await getState(page);
    expect(state.secrets.indexOf('移動テスト')).toBe(originalIndex);

    await page.getByRole('button', { name: 'Undo' }).click();

    state = await getState(page);
    expect(state.secrets.indexOf('移動テスト')).toBe(originalIndex - 1);
  });

  test('一方通行の感情を登録できる', async ({ page }) => {
    await openFresh(page);

    await addOneWayEmotion(page, 'PC1', 'PC2');

    const state = await getState(page);

    expect(state.emotions).toHaveLength(1);
    expect(state.emotions[0].from).toBe('PC1');
    expect(state.emotions[0].to).toBe('PC2');
    expect(state.emotions[0].type).toBe('友情');
    expect(state.emotions[0].polarity).toBe('＋');
  });

  test('相互感情では2方向が登録される', async ({ page }) => {
    await openFresh(page);

    await page.locator('#emotionFrom').selectOption('PC1');
    await page.locator('#emotionTo').selectOption('PC2');

    await page.locator('#emotionPositive1').selectOption({
      label: '友情（＋）'
    });
    await page.locator('#emotionPositive2').selectOption({
      label: '愛情（＋）'
    });

    await page.getByRole('button', { name: '感情を登録' }).click();

    const state = await getState(page);

    expect(state.emotions).toHaveLength(2);

    expect(state.emotions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'PC1',
          to: 'PC2',
          type: '友情',
          polarity: '＋'
        }),
        expect.objectContaining({
          from: 'PC2',
          to: 'PC1',
          type: '愛情',
          polarity: '＋'
        })
      ])
    );
  });

  test('感情共有：秘密を得た瞬間だけ共有される', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, '共有テスト');
    await addOneWayEmotion(page, 'PC1', 'PC2');

    await clickMatrixCell(page, 1, 6);

    let state = await getState(page);

    expect(state.matrix.PC2['共有テスト']).toBe(true);
    expect(state.matrix.PC1['共有テスト']).toBe(true);
  });

  test('後から感情を追加しても過去の秘密には遡及しない', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, '遡及テスト');

    await clickMatrixCell(page, 1, 6);

    let state = await getState(page);

    expect(state.matrix.PC2['遡及テスト']).toBe(true);
    expect(state.matrix.PC1['遡及テスト']).toBe(false);

    await addOneWayEmotion(page, 'PC1', 'PC2');

    state = await getState(page);

    expect(state.matrix.PC2['遡及テスト']).toBe(true);
    expect(state.matrix.PC1['遡及テスト']).toBe(false);
  });

  test('自動共有OFFでは秘密を得ても感情共有されない', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, 'OFFテスト');
    await addOneWayEmotion(page, 'PC1', 'PC2');

    await page.locator('#autoShareKnowledge').uncheck();

    await clickMatrixCell(page, 1, 6);

    const state = await getState(page);

    expect(state.autoShareKnowledge).toBe(false);
    expect(state.matrix.PC2['OFFテスト']).toBe(true);
    expect(state.matrix.PC1['OFFテスト']).toBe(false);
  });

  test('自動共有をONに戻しても過去の取得には遡及しない', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, 'ON復帰テスト');
    await addOneWayEmotion(page, 'PC1', 'PC2');

    await page.locator('#autoShareKnowledge').uncheck();
    await clickMatrixCell(page, 1, 6);

    await page.locator('#autoShareKnowledge').check();

    const state = await getState(page);

    expect(state.matrix.PC2['ON復帰テスト']).toBe(true);
    expect(state.matrix.PC1['ON復帰テスト']).toBe(false);
  });

  test('感情共有は連鎖しない', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, '連鎖テスト');

    await addOneWayEmotion(page, 'PC1', 'PC2');

    await page.locator('#emotionFrom').selectOption('PC2');
    await page.locator('#emotionTo').selectOption('PC3');
    await page.locator('#emotionPositive1').selectOption({
      label: '友情（＋）'
    });
    await page.getByRole('button', { name: '感情を登録' }).click();

    await clickMatrixCell(page, 2, 6);

    const state = await getState(page);

    expect(state.matrix.PC3['連鎖テスト']).toBe(true);
    expect(state.matrix.PC2['連鎖テスト']).toBe(true);
    expect(state.matrix.PC1['連鎖テスト']).toBe(false);
  });

  test('直接マトリクス操作の×→○と○→×は他PCへ影響しない', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, '直接操作テスト');

    await clickMatrixCell(page, 1, 6);

    let state = await getState(page);

    expect(state.matrix.PC2['直接操作テスト']).toBe(true);
    expect(state.matrix.PC3['直接操作テスト']).toBe(false);

    await clickMatrixCell(page, 1, 6);

    state = await getState(page);

    expect(state.matrix.PC2['直接操作テスト']).toBe(false);
    expect(state.matrix.PC3['直接操作テスト']).toBe(false);
  });

  test('PC人数を増減すると追加PCと秘密が管理される', async ({ page }) => {
    await openFresh(page);

    await page.getByRole('button', { name: 'PC人数を増やす' }).click();

    let state = await getState(page);

    expect(state.playerCount).toBe(7);
    expect(state.secrets).toContain('PC7の秘密');

    await page.getByRole('button', { name: 'PC人数を減らす' }).click();

    state = await getState(page);

    expect(state.playerCount).toBe(6);
  });

  test('画像タイトルを変更できUndoできる', async ({ page }) => {
    await openFresh(page);

    await page.locator('#imageTitleInput').fill('テストタイトル');
    await page.getByRole('button', { name: 'タイトルを反映' }).click();

    let state = await getState(page);
    expect(state.imageTitle).toBe('テストタイトル');

    await page.getByRole('button', { name: 'Undo' }).click();

    state = await getState(page);
    expect(state.imageTitle).toBe('タイトルを入力');
  });

  test('JSONデータを書き出せる', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, 'JSONテスト');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '管理データを保存' }).click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('秘密管理データ.json');
  });

  test('PNG画像を書き出せる', async ({ page }) => {
    await openFresh(page);

    await page.locator('#imageTitleInput').fill('PNGテスト');
    await page.getByRole('button', { name: 'タイトルを反映' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '画像を保存' }).click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('PNGテスト.png');
  });

  test('JSONデータを読み込める', async ({ page }) => {
    await openFresh(page);

    const imported = {
      playerCount: 2,
      layoutOrder: [
        'pcSettings',
        'secretManagement',
        'emotionManagement',
        'imageTitle',
        'cocofolia',
        'matrixPreview'
      ],
      playerNames: {
        PC1: '読み込みPC1',
        PC2: '読み込みPC2'
      },
      secrets: ['読み込み秘密'],
      secretOwners: {
        '読み込み秘密': null
      },
      secretLabels: {},
      publicSecrets: [],
      autoShareKnowledge: true,
      matrix: {
        PC1: { '読み込み秘密': true },
        PC2: { '読み込み秘密': false }
      },
      directMatrix: {
        PC1: { '読み込み秘密': true },
        PC2: { '読み込み秘密': false }
      },
      emotions: [],
      imageTitleMode: 'free',
      imageTitle: '読み込みタイトル',
      cycleScene: '1サイクル1シーン目',
      uiSelections: {}
    };

    await page.locator('#importData').setInputFiles({
      name: 'test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(imported), 'utf-8')
    });

    const state = await getState(page);

    expect(state.playerCount).toBe(2);
    expect(state.playerNames.PC1).toBe('読み込みPC1');
    expect(state.secrets).toContain('読み込み秘密');
    expect(state.imageTitle).toBe('読み込みタイトル');
  });

  test('v8に外部通信系のコードが入っていない', async () => {
    const source = fs.readFileSync(APP_PATH, 'utf8');

    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/WebSocket\s*\(/);
    expect(source).not.toMatch(/sendBeacon\s*\(/);
    expect(source).not.toMatch(/<script[^>]+src=/i);
    expect(source).not.toMatch(/<iframe\b/i);
  });

  test('秘密ヘッダーをドラッグして並べ替えられる', async ({ page }) => {
    await openFresh(page);

    await addSecret(page, 'ドラッグA');
    await addSecret(page, 'ドラッグB');

    let state = await getState(page);

    const indexA = state.secrets.indexOf('ドラッグA');
    const indexB = state.secrets.indexOf('ドラッグB');

    expect(indexA).toBeLessThan(indexB);

    await dragSecret(page, 'ドラッグA', 'ドラッグB');

    state = await getState(page);

    expect(state.secrets.indexOf('ドラッグA')).toBeGreaterThan(
      state.secrets.indexOf('ドラッグB')
    );
  });

});
