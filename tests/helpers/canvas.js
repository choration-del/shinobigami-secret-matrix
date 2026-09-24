// Derive hit targets from v8's live drawing layout, then reveal the target.
async function canvasPoint(page, secret, row = null) {
  const canvas = page.locator('#matrixCanvas');
  return canvas.evaluate((el, {secret, row}) => {
    if (typeof lastLayout === 'undefined' || !lastLayout) throw new Error('v8 lastLayout is unavailable');
    const layout = lastLayout;
    const index = typeof secret === 'number' ? secret : layout.secretData.findIndex(d => d.secret === secret);
    if (!layout.secretData[index]) throw new Error('Secret column not found: ' + secret);
    if (row !== null && (row < 0 || row >= playerIds.length)) throw new Error('Invalid player row');
    const x = layout.startX + layout.nameWidth + layout.secretData.slice(0,index).reduce((n,d) => n+d.width,0) + layout.secretData[index].width/2;
    const y = row === null ? layout.startY + layout.headerHeight/2 : layout.startY + layout.headerHeight + layout.cellHeight*(row+0.5);
    const preview = el.closest('#preview');
    let rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) throw new Error('Canvas is not visible');
    const bounds = preview.getBoundingClientRect();
    const targetX = rect.left + x*rect.width/el.width;
    if (targetX < bounds.left+12 || targetX > bounds.right-12) preview.scrollLeft += targetX-(bounds.left+bounds.width/2);
    rect = el.getBoundingClientRect();
    const targetY = rect.top+y*rect.height/el.height;
    if (targetY < 20 || targetY > innerHeight-20) window.scrollBy(0,targetY-innerHeight/2);
    rect = el.getBoundingClientRect();
    return {x:rect.left+x*rect.width/el.width, y:rect.top+y*rect.height/el.height};
  }, {secret,row});
}
async function clickMatrixCell(page,row,secret) {
  const point=await canvasPoint(page,secret,row);
  await page.mouse.click(point.x,point.y);
}
async function dragSecret(page,fromSecret,toSecret) {
  const from=await canvasPoint(page,fromSecret);
  await page.mouse.move(from.x,from.y);
  await page.mouse.down();
  try {
    // Move enough to begin dragging before scrolling to a distant column.
    await page.mouse.move(from.x+8,from.y,{steps:2});
    const to=await canvasPoint(page,toSecret);
    await page.mouse.move(to.x,to.y,{steps:12});
  } finally { await page.mouse.up(); }
}
module.exports={canvasPoint,clickMatrixCell,dragSecret};
