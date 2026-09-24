const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
// Serve only application entry points; never expose .git, tests or node_modules.
const pages = new Set(['index.html', 'シノビガミ秘密管理.html', 'シノビガミ秘密管理_v8_test.html']);
const server = http.createServer((req, res) => {
  // Only the Playwright run that launched this server can request shutdown.
  if (req.url === '/__e2e_shutdown' && req.method === 'POST') {
    const token = process.env.SHINOBI_E2E_SERVER_TOKEN;
    if (!token || req.headers.authorization !== 'Bearer ' + token) { res.writeHead(403); return res.end(); }
    res.writeHead(200);
    res.end('Stopping');
    server.close();
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html'; }
  catch { res.writeHead(400); return res.end(); }
  if (name === 'favicon.ico') { res.writeHead(204); return res.end(); }
  if (name === '__e2e_health') { res.writeHead(200, {'Content-Type':'text/plain'}); return res.end('shinobigami-e2e'); }
  if (!pages.has(name)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(root, name), (err, data) => {
    if (err) { res.writeHead(500); return res.end('Read failed'); }
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.on('error', error => { console.error(error); process.exit(1); });
server.listen(4173, '127.0.0.1', () => console.log('App: http://127.0.0.1:4173'));
