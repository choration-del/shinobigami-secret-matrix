const base = require('@playwright/test');
const test = base.test.extend({
  browserDiagnostics: [async ({page}, use, testInfo) => {
    const events = [];
    const consoleListener = msg => { if (['error','warning'].includes(msg.type())) events.push({type:msg.type(), text:msg.text(), location:msg.location()}); };
    const errorListener = error => events.push({type:'pageerror', text:error.stack || error.message});
    page.on('console', consoleListener);
    page.on('pageerror', errorListener);
    await use(events);
    await testInfo.attach('browser-log', {body:Buffer.from(JSON.stringify(events,null,2)), contentType:'application/json'});
    page.off('console', consoleListener);
    page.off('pageerror', errorListener);
    const errors = events.filter(e => e.type !== 'warning');
    if (errors.length) console.error(JSON.stringify(errors,null,2));
    base.expect(errors, 'Browser console/page errors (see browser-log)').toEqual([]);
  }, {auto:true}],
});
module.exports = {test, expect:base.expect};
