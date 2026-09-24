// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const serverToken = require('node:crypto').randomUUID();
module.exports = defineConfig({
  testDir: './tests',
  globalTeardown: require.resolve('./scripts/stop-server.cjs'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  outputDir: 'test-results/e2e',
  reporter: [['list'], ['html', {open:'never'}]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    viewport: {width:1280, height:900},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: process.env.PW_VIDEO === 'on' ? 'on' : 'off',
  },
  projects: [
    {name:'chromium', testMatch:['**/shinobigami.spec.js', '**/environment.spec.js']},
    {name:'v8', testMatch:'**/shinobigami-v8-*.spec.js', use:{defaultBrowserType:'chromium'}, testIgnore:[],},
    {name:'examples', testMatch:'**/example.spec.js'},
  ],
  webServer: {
    command:'node scripts/serve.cjs',
    env: {SHINOBI_E2E_SERVER_TOKEN: serverToken},
    url:'http://127.0.0.1:4173/__e2e_health',
    reuseExistingServer: !process.env.CI,
    timeout:15000,
  },
});
