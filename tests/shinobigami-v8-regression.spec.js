const {test,expect}=require('./helpers/fixtures');
const {clickMatrixCell,dragSecret}=require('./helpers/canvas');
const fs=require('node:fs/promises');
const url='/シノビガミ秘密管理_v8_test.html';
const read=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shinobigami_secret_matrix_v1')));
const live=page=>page.evaluate(()=>JSON.parse(JSON.stringify(state)));
const click=(page,id)=>page.locator('#'+id).click();
const add=async(page,name)=>{await page.locator('#newSecret').fill(name);await click(page,'addSecret');};
const names=page=>page.locator('#pcInputs input[data-player-id="PC1"]');
async function emotion(page,from,to,negative=false,mutual=false){
 await page.locator('#emotionFrom').selectOption(from);await page.locator('#emotionTo').selectOption(to);
 await page.locator('#mutualEmotion').setChecked(mutual);
 await page.locator(negative?'#emotionNegative1':'#emotionPositive1').selectOption(negative?'怒り|－':'友情|＋');
 if(mutual)await page.locator('#emotionPositive2').selectOption('愛情|＋');
 await click(page,'addEmotion');
}
async function count(page,n){await page.locator('#playerCount').fill(String(n));await page.locator('#playerCount').press('Tab');}
test.beforeEach(async({page})=>{await page.goto(url);});

test('PC名のUndoが画面と保存状態を一致させる',async({page})=>{
 await names(page).fill('アリス');await click(page,'applyNames');await click(page,'undoButton');
 expect((await read(page)).playerNames.PC1).toBe('PC1');await expect(names(page)).toHaveValue('PC1');
 await click(page,'redoButton');await expect(names(page)).toHaveValue('アリス');
});
test('未反映のPC名は別操作とUndoを跨いで保持',async({page})=>{
 await names(page).fill('入力途中');await add(page,'一時秘密');await click(page,'undoButton');
 await expect(names(page)).toHaveValue('入力途中');expect((await read(page)).playerNames.PC1).toBe('PC1');
});
test('リセットは入力途中のPC名も初期化しUndo可能',async({page})=>{
 await names(page).fill('確定名');await click(page,'applyNames');await names(page).fill('未反映');
 page.once('dialog',d=>d.accept());await click(page,'resetData');
 await expect(names(page)).toHaveValue('PC1');await click(page,'undoButton');
 expect((await read(page)).playerNames.PC1).toBe('確定名');
});
test('名前変更後も変更した秘密を選択し続ける',async({page})=>{
 await add(page,'変更元');await page.locator('#secretSelect').selectOption('変更元');
 page.once('dialog',d=>d.accept('変更先'));await click(page,'renameSecretButton');
 await expect(page.locator('#secretSelect')).toHaveValue('変更先');
 await click(page,'moveSecretUpButton');expect((await read(page)).secrets.at(-2)).toBe('変更先');
});
test('表示名と内部名の衝突で秘密データを上書きしない',async({page})=>{
 await names(page).fill('アリス');await click(page,'applyNames');await add(page,'別秘密');
 await page.locator('#secretSelect').selectOption('別秘密');const before=await read(page);
 page.once('dialog',d=>d.accept('PC1の秘密'));await click(page,'renameSecretButton');
 const after=await read(page);expect(new Set(after.secrets).size).toBe(after.secrets.length);
 expect(after.secretOwners['PC1の秘密']).toBe('PC1');expect(after.secrets).toEqual(before.secrets);
});
test('共有の再取得・非連鎖・マイナス感情・Undo/Redo',async({page})=>{
 await add(page,'共有');await emotion(page,'PC1','PC2',true);await emotion(page,'PC3','PC1');
 await clickMatrixCell(page,1,'共有');let s=await read(page);
 expect(s.matrix.PC1['共有']).toBe(true);expect(s.matrix.PC3['共有']).toBe(false);
 await click(page,'undoButton');s=await read(page);expect(s.matrix.PC1['共有']).toBe(false);expect(s.matrix.PC2['共有']).toBe(false);
 await click(page,'redoButton');expect((await read(page)).matrix.PC1['共有']).toBe(true);
 await clickMatrixCell(page,0,'共有');expect((await read(page)).matrix.PC1['共有']).toBe(false);
 await clickMatrixCell(page,1,'共有');expect((await read(page)).matrix.PC1['共有']).toBe(false);
 await clickMatrixCell(page,1,'共有');s=await read(page);expect(s.matrix.PC1['共有']).toBe(true);expect(s.matrix.PC3['共有']).toBe(false);
 await page.reload();expect((await read(page)).matrix).toEqual(s.matrix);
});
test('共有ON復帰は新しい取得だけ共有し方向を逆転しない',async({page})=>{
 await add(page,'過去');await add(page,'新規');await emotion(page,'PC1','PC2');
 await page.locator('#autoShareKnowledge').uncheck();await clickMatrixCell(page,1,'過去');
 await page.locator('#autoShareKnowledge').check();expect((await read(page)).matrix.PC1['過去']).toBe(false);
 await clickMatrixCell(page,0,'新規');expect((await read(page)).matrix.PC2['新規']).toBe(false);
 await clickMatrixCell(page,0,'新規');await clickMatrixCell(page,1,'新規');expect((await read(page)).matrix.PC1['新規']).toBe(true);
});
test('相互感情の更新は1回のUndoで戻り過去共有しない',async({page})=>{
 await add(page,'過去');await clickMatrixCell(page,1,'過去');await emotion(page,'PC1','PC2',false,true);
 expect((await read(page)).matrix.PC1['過去']).toBe(false);
 await emotion(page,'PC1','PC2',true,true);expect((await read(page)).emotions).toHaveLength(2);
 await click(page,'undoButton');expect((await read(page)).emotions[0].type).toBe('友情');
 await click(page,'undoButton');expect((await read(page)).emotions).toHaveLength(0);
});
test('全体公開を1回Undoすると混在した公開前状態へ戻る',async({page})=>{
 await add(page,'混在');await emotion(page,'PC1','PC2');await clickMatrixCell(page,1,'混在');
 await page.locator('#secretSelect').selectOption('混在');const before=await read(page);
 await click(page,'publicButton');for(let n=1;n<=6;n++)expect((await read(page)).matrix['PC'+n]['混在']).toBe(true);
 await click(page,'undoButton');expect((await read(page)).matrix).toEqual(before.matrix);
 await click(page,'redoButton');expect((await read(page)).publicSecrets).toContain('混在');
});
test('人数変更の境界と非表示PCのデータ保持',async({page})=>{
 await add(page,'人数');await clickMatrixCell(page,5,'人数');await count(page,2);
 await expect(page.locator('#pcInputs input')).toHaveCount(2);await count(page,6);
 expect((await read(page)).matrix.PC6['人数']).toBe(true);
 await count(page,10);await click(page,'increasePlayerCount');await expect(page.locator('#playerCount')).toHaveValue('10');
 await count(page,1);await click(page,'decreasePlayerCount');await expect(page.locator('#playerCount')).toHaveValue('1');
 await click(page,'undoButton');await expect(page.locator('#playerCount')).toHaveValue('10');
});
test('各選択欄とサイクル・シーンの保持と反映Undo',async({page})=>{
 await page.locator('input[value="cycle"]').check();await page.locator('#cycleSelect').selectOption('3');await page.locator('#sceneSelect').selectOption('5');
 await page.locator('#emotionFrom').selectOption('PC3');await page.locator('#emotionTo').selectOption('PC4');
 await page.locator('#emotionNegative1').selectOption('怒り|－');await page.locator('#secretSelect').selectOption('PC4の秘密');
 await add(page,'選択保持');await click(page,'applyCycleScene');expect((await read(page)).cycleScene).toBe('3サイクル5シーン目');
 await click(page,'undoButton');expect((await read(page)).cycleScene).toBe('1サイクル1シーン目');
 await click(page,'redoButton');await page.reload();
 for(const [id,value] of Object.entries({cycleSelect:'3',sceneSelect:'5',emotionFrom:'PC3',emotionTo:'PC4',emotionNegative1:'怒り|－',secretSelect:'PC4の秘密'}))await expect(page.locator('#'+id)).toHaveValue(value);
 await count(page,2);await expect(page.locator('#sceneSelect option')).toHaveCount(2);
});
test('JSON実ファイル往復と未反映PC名の除去',async({page})=>{
 await names(page).fill('保存名');await click(page,'applyNames');await add(page,'往復');await clickMatrixCell(page,2,'往復');
 await page.locator('#secretSelect').selectOption('往復');const expected=await read(page);
 const downloaded=page.waitForEvent('download');await click(page,'exportData');const file=await downloaded;const data=await fs.readFile(await file.path());
 expect(JSON.parse(data)).toEqual(expected);
 await names(page).fill('別の入力途中');await page.locator('#importData').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:data});
 await expect(page.locator('#status')).toHaveText('管理データを読み込みました。');
 await expect(names(page)).toHaveValue('保存名');expect((await read(page)).matrix).toEqual(expected.matrix);
 await page.reload();expect((await read(page)).matrix).toEqual(expected.matrix);
});
test('不正JSONの失敗で現在データとUndo履歴を壊さない',async({page})=>{
 await add(page,'守るデータ');const before=await live(page);const depth=await page.evaluate(()=>undoStack.length);
 await page.locator('#importData').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({playerNames:'broken',secrets:['不正'],secretOwners:{},matrix:{}}))});
 await expect(page.locator('#status')).toHaveText('管理データを読み込めませんでした。');
 expect(await live(page)).toEqual(before);expect(await page.evaluate(()=>undoStack.length)).toBe(depth);
 await add(page,'続行可能');expect((await read(page)).secrets).toContain('続行可能');
});
test('PNG実ファイルの形式とCanvas寸法',async({page})=>{
 await page.locator('#imageTitleInput').fill('出力確認');await click(page,'applyImageTitle');
 const downloaded=page.waitForEvent('download');await click(page,'savePng');const file=await downloaded;const bytes=await fs.readFile(await file.path());
 expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
 const size=await page.locator('#matrixCanvas').evaluate(c=>({w:c.width,h:c.height}));
 expect(bytes.readUInt32BE(16)).toBe(size.w);expect(bytes.readUInt32BE(20)).toBe(size.h);
});
test('列ドラッグは1回のUndoで戻りセルを誤変更しない',async({page})=>{
 await add(page,'長い秘密の名前'.repeat(8));await add(page,'移動先');const before=await read(page);
 await dragSecret(page,'長い秘密の名前'.repeat(8),'PC2の秘密');expect((await read(page)).matrix).toEqual(before.matrix);
 await click(page,'undoButton');expect((await read(page)).secrets).toEqual(before.secrets);
});
test('パネルのドラッグ並べ替え・再読み込み・Undo',async({page})=>{
 const before=(await read(page)).layoutOrder;
 await page.locator('[data-section-id="secretManagement"] .drag-handle').dragTo(page.locator('[data-section-id="pcSettings"] h2').first());
 await expect.poll(async()=> (await read(page)).layoutOrder[0]).toBe('secretManagement');
 await expect(page.locator('#undoButton')).toBeEnabled();await click(page,'undoButton');expect((await read(page)).layoutOrder).toEqual(before);
 await click(page,'redoButton');await page.reload();expect((await read(page)).layoutOrder[0]).toBe('secretManagement');
});
for(const width of [1280,390])test('多数PC・秘密の表示と操作 幅'+width,async({page},info)=>{
 await page.setViewportSize({width,height:900});await count(page,10);
 for(let n=0;n<20;n++)await add(page,'追加'+n);
 expect((await read(page)).secrets).toHaveLength(30);await add(page,'上限超え');await expect(page.locator('#status')).toHaveText('秘密は30個までです。');
 await clickMatrixCell(page,9,'追加19');expect((await read(page)).matrix.PC10['追加19']).toBe(true);
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));expect(size.scroll).toBeLessThanOrEqual(size.viewport);
 await info.attach('large-canvas',{body:await page.locator('#matrixCanvas').screenshot(),contentType:'image/png'});
});
test('PC固有秘密の削除は人数変更・再読込・JSON往復後も維持',async({page})=>{
 await page.locator('#secretSelect').selectOption('PC6の秘密');page.once('dialog',d=>d.accept());await click(page,'deleteSecretButton');
 await click(page,'undoButton');expect((await read(page)).secrets).toContain('PC6の秘密');
 await click(page,'redoButton');expect((await read(page)).secrets).not.toContain('PC6の秘密');
 await count(page,5);await count(page,6);expect((await read(page)).secrets).not.toContain('PC6の秘密');
 await page.reload();expect((await read(page)).secrets).not.toContain('PC6の秘密');
 const downloaded=page.waitForEvent('download');await click(page,'exportData');const buffer=await fs.readFile(await (await downloaded).path());
 await page.locator('#importData').setInputFiles({name:'deleted.json',mimeType:'application/json',buffer});
 await expect(page.locator('#status')).toHaveText('管理データを読み込みました。');expect((await read(page)).secrets).not.toContain('PC6の秘密');
 await count(page,7);expect((await read(page)).secrets).toContain('PC7の秘密');
});
test('全体公開後も本人の秘密はダッシュ表示し操作を拒否',async({page})=>{
 await page.locator('#secretSelect').selectOption('PC1の秘密');await click(page,'publicButton');
 const drawn=await page.evaluate(()=>{
  const ctx=document.getElementById('matrixCanvas').getContext('2d'),draw=ctx.fillText;const texts=[];
  ctx.fillText=function(text,...args){texts.push(text);return draw.call(this,text,...args);};
  try{makeMatrixImage();}finally{ctx.fillText=draw;}
  return texts;
 });
 expect(drawn.filter(t=>t==='－')).toHaveLength(6);
 await clickMatrixCell(page,0,'PC1の秘密');await expect(page.locator('#status')).toContainText('自分自身の秘密は変更できません');
});
test('狭い画面の横スクロールと遠い列のドラッグ',async({page},info)=>{
 await page.setViewportSize({width:390,height:850});await add(page,'遠い列');
 const dims=await page.locator('#preview').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));expect(dims.scroll).toBeGreaterThan(dims.client);
 const size=await page.locator('#matrixCanvas').evaluate(c=>({css:c.getBoundingClientRect().width,pixels:c.width}));expect(size.css).toBe(size.pixels);
 await dragSecret(page,'PC1の秘密','遠い列');expect((await read(page)).secrets.at(-1)).toBe('PC1の秘密');
 await info.attach('post-drag-state',{body:Buffer.from(JSON.stringify(await page.evaluate(()=>({suppressNextMatrixClick,scrollX,scrollY,previewScroll:document.getElementById('preview').scrollLeft})))),contentType:'application/json'});
 await clickMatrixCell(page,1,'遠い列');expect((await read(page)).matrix.PC2['遠い列']).toBe(true);
 await expect.poll(()=>page.locator('#preview').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 await info.attach('narrow-scroll',{body:await page.screenshot(),contentType:'image/png'});
});
test('感情のUndo後もプラス・マイナス選択が排他的',async({page})=>{
 await emotion(page,'PC1','PC2');await emotion(page,'PC1','PC2',true);await click(page,'undoButton');
 await expect(page.locator('#emotionNegative1')).toHaveValue('怒り|－');
 await expect(page.locator('#emotionPositive1')).toHaveValue('');
 await click(page,'addEmotion');expect((await read(page)).emotions[0].type).toBe('怒り');
});
test('感情削除でも共有済み情報を保持しUndoできる',async({page})=>{
 await add(page,'既知');await emotion(page,'PC1','PC2');await clickMatrixCell(page,1,'既知');
 await page.locator('#emotionList button').click();expect((await read(page)).emotions).toHaveLength(0);expect((await read(page)).matrix.PC1['既知']).toBe(true);
 await click(page,'undoButton');expect((await read(page)).emotions).toHaveLength(1);
});
test('公開で追加した秘密はUndo一回で追加ごと戻る',async({page})=>{
 await page.locator('#newSecretPublic').check();await add(page,'公開追加');
 for(let n=1;n<=6;n++)expect((await read(page)).matrix['PC'+n]['公開追加']).toBe(true);
 await click(page,'undoButton');expect((await read(page)).secrets).not.toContain('公開追加');
 await click(page,'redoButton');expect((await read(page)).publicSecrets).toContain('公開追加');
});
test('JSONで保存した選択欄を現在の選択で上書きしない',async({page})=>{
 await page.locator('#emotionFrom').selectOption('PC3');await page.locator('#secretSelect').selectOption('PC4の秘密');const before=await read(page);
 await page.locator('#emotionFrom').selectOption('PC1');await page.locator('#secretSelect').selectOption('PC1の秘密');
 await page.locator('#importData').setInputFiles({name:'select.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});
 await expect(page.locator('#status')).toHaveText('管理データを読み込みました。');
 await expect(page.locator('#emotionFrom')).toHaveValue('PC3');await expect(page.locator('#secretSelect')).toHaveValue('PC4の秘密');
});
