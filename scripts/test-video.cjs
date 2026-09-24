const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', ...process.argv.slice(2)], {stdio:'inherit', env:{...process.env, PW_VIDEO:'on'}});
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
