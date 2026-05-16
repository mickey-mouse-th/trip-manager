/**
 * Builds preview.html for local browser testing.
 * Combines Index.html + Style.html + Script.html into one file.
 *
 * Usage:  node build-preview.js
 * Then:   open preview.html   (or: python3 -m http.server 3000)
 *
 * To enable mock data (no Google Sheet needed):
 *   localStorage.setItem('dev_mock', '1')   ← paste in browser console
 *
 * To use real Google Sheet (Apps Script deployed URL):
 *   localStorage.removeItem('dev_mock')
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const dir    = __dirname;
const style  = fs.readFileSync(path.join(dir, 'Style.html'),  'utf8');
const script = fs.readFileSync(path.join(dir, 'Script.html'), 'utf8');
const login  = fs.readFileSync(path.join(dir, 'Login.html'),  'utf8');
let   html   = fs.readFileSync(path.join(dir, 'Index.html'),  'utf8');

html = html.replace("<?!= include('Style') ?>",  style);
html = html.replace("<?!= include('Script') ?>", script);
html = html.replace("<?!= include('Login') ?>",  login);

fs.writeFileSync(path.join(dir, 'preview.html'), html, 'utf8');
console.log('✅  preview.html built — open it in your browser');
console.log('');
console.log('    Enable mock:  localStorage.setItem(\'dev_mock\', \'1\')');
console.log('    Disable mock: localStorage.removeItem(\'dev_mock\')');
