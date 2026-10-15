#!/usr/bin/env node
'use strict';
// Development only. Production uses the existing HTTPS host.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (_) { res.writeHead(400); res.end('Ruta inválida'); return; }
  if (pathname === '/' || pathname === '/agenda-offline') { res.writeHead(302, { Location: '/agenda-offline/' }); res.end(); return; }
  if (pathname.includes('\0') || pathname.includes('\\')) { res.writeHead(400); res.end('Ruta inválida'); return; }
  const relative = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
  const file = path.resolve(ROOT, '.' + relative);
  if (!file.startsWith(ROOT + path.sep) || !pathname.startsWith('/agenda-offline/')) { res.writeHead(404); res.end('No encontrado'); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); res.end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file).on('error', () => { res.destroy(); }).pipe(res);
  });
}
if (require.main === module) {
  const port = Number(process.env.AGENDA_PORT || 8080);
  const server = http.createServer(handler);
  server.listen(port, '127.0.0.1', () => {
    console.log('Agenda y apuntes: http://localhost:' + port + '/agenda-offline/');
    console.log('Mantén esta ventana abierta. Ctrl+C para detener.');
    console.log('Para teléfonos, utiliza el alojamiento HTTPS existente.');
  });
  server.on('error', error => { console.error('No se pudo iniciar:', error.message); process.exitCode = 1; });
}
module.exports = { handler };
