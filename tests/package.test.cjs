'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Writable}=require('node:stream');
const ROOT=path.join(__dirname,'../public/agenda-offline');
const {handler}=require('../dev-server.cjs');
function request(url,method='GET'){
  return new Promise((resolve,reject)=>{
    const chunks=[];let status,headers;
    const res=new Writable({write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});
    res.writeHead=(code,values={})=>{status=code;headers=values;return res;};
    res.on('error',reject);res.on('finish',()=>resolve({status,headers,body:Buffer.concat(chunks).toString()}));
    handler({url,method},res);
  });
}
test('manifiesto relativo y todos sus iconos incluidos con tamaño PNG correcto',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
  for(const icon of manifest.icons){const buf=fs.readFileSync(path.join(ROOT,icon.src));const [w,h]=icon.sizes.split('x').map(Number);assert.equal(buf.readUInt32BE(16),w);assert.equal(buf.readUInt32BE(20),h);}
});
test('todos los IDs usados por la app existen; no hay recursos externos ni archivos faltantes',()=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  const js=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
  for(const [,id] of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),'ID ausente: '+id);
  for(const [,ref] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))assert.ok(fs.existsSync(path.join(ROOT,ref)),ref);
  assert.doesNotMatch(html,/(?:src|href)="https?:\/\//);
  assert.doesNotMatch(js,/\.innerHTML\s*=/);
  const packageJson=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));assert.equal(packageJson.dependencies,undefined);
});
test('servidor local entrega tipos correctos, sin iniciar conexiones de escucha',async()=>{
  for(const [file,mime] of [['sw.js','application/javascript'],['manifest.webmanifest','application/manifest+json'],['styles.css','text/css'],['','text/html']]){
    const res=await request('/agenda-offline/'+file);assert.equal(res.status,200);assert.ok(res.headers['Content-Type'].startsWith(mime));assert.equal(res.headers['Cache-Control'],'no-cache');
  }
});
test('servidor limita rutas, redirige la entrada y rechaza traversal y métodos de escritura',async()=>{
  assert.equal((await request('/')).headers.Location,'/agenda-offline/');
  assert.equal((await request('/agenda-offline')).status,302);
  for(const uri of ['/dev-server.cjs','/agenda-offline/%2e%2e%2f%2e%2e%2fLEEME.md','/agenda-offline/missing.js'])assert.equal((await request(uri)).status,404,uri);
  assert.equal((await request('/agenda-offline/','POST')).status,405);
  assert.equal((await request('/agenda-offline/%ZZ')).status,400);
});
test('servidor respeta HEAD sin enviar cuerpo',async()=>{
  const res=await request('/agenda-offline/','HEAD');assert.equal(res.status,200);assert.equal(res.body,'');assert.ok(res.headers['Content-Length']>0);
});
