'use strict';
const fs   = require('fs');
const path = require('path');
const http = require('http');

const dir   = __dirname;
const PORT  = 3000;
const WATCH = ['Index.html', 'Style.html', 'Script.html', 'Login.html'];

function build() {
  try {
    const style  = fs.readFileSync(path.join(dir, 'Style.html'),  'utf8');
    const script = fs.readFileSync(path.join(dir, 'Script.html'), 'utf8');
    const login  = fs.readFileSync(path.join(dir, 'Login.html'),  'utf8');
    let   html   = fs.readFileSync(path.join(dir, 'Index.html'),  'utf8');
    html = html.replace("<?!= include('Style') ?>",  style);
    html = html.replace("<?!= include('Script') ?>", script);
    html = html.replace("<?!= include('Login') ?>",  login);
    fs.writeFileSync(path.join(dir, 'preview.html'), html, 'utf8');
    console.log('[' + new Date().toLocaleTimeString() + '] ✅ rebuilt preview.html');
  } catch (e) {
    console.error('[build error]', e.message);
  }
}

// Debounce so rapid saves don't trigger multiple builds
let timer = null;
function debouncedBuild() {
  clearTimeout(timer);
  timer = setTimeout(build, 80);
}

// Watch source files
WATCH.forEach(function (file) {
  fs.watch(path.join(dir, file), debouncedBuild);
});

// Simple static server
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(function (req, res) {
  let filePath = path.join(dir, req.url === '/' ? '/preview.html' : req.url);
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

build();
server.listen(PORT, function () {
  console.log('');
  console.log('  🌍  http://localhost:' + PORT + '/preview.html');
  console.log('  👀  watching: ' + WATCH.join(', '));
  console.log('  ⚡  auto-rebuilds on every save');
  console.log('');
  console.log('  Mock:  localStorage.setItem(\'dev_mock\', \'1\')');
  console.log('');
});
