'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../public/agenda-offline/sw.js'),'utf8');
function environment(shared = new Map(), online = true) {
  const listeners={};let fetchCount=0;
  const makeResponse=url=>new Response('Asset: '+url,{status:200});
  const key=req=>typeof req==='string'?req:req.url;
  const cacheStore={
    async open(name){if(!shared.has(name))shared.set(name,new Map());const entries=shared.get(name);return {
      async addAll(requests){if(!online)throw new Error('offline');for(const req of requests)entries.set(key(req),makeResponse(key(req)));},
      async match(req){const r=entries.get(key(req));return r&&r.clone();},
      async put(req,res){entries.set(key(req),res.clone());}
    };},
    async keys(){return [...shared.keys()];},async delete(name){return shared.delete(name);}
  };
  const self={location:{href:'https://example.test/agenda-offline/sw.js'},clients:{async claim(){}},addEventListener:(name,fn)=>{listeners[name]=fn;}};
  vm.runInNewContext(script,{self,caches:cacheStore,URL,Request,Response,fetch:async req=>{fetchCount++;if(!online)throw new Error('offline');return makeResponse(key(req));}});
  return {shared,cacheStore,fetchCount:()=>fetchCount,setOnline:value=>{online=value;},async lifecycle(name){let result;listeners[name]({waitUntil:p=>{result=p;}});await result;},async request(url,mode='navigate',method='GET'){let result;listeners.fetch({request:{url,mode,method},respondWith:p=>{result=p;}});return result?await result:null;},async ready(){let result,answer;listeners.message({data:{type:'OFFLINE_STATUS'},ports:[{postMessage:value=>{answer=value;}}],waitUntil:p=>{result=p;}});await result;return answer;}};
}
test('instala todos los recursos y vuelve a abrir la app sin red tras reiniciar el worker',async()=>{
  const first=environment();await first.lifecycle('install');await first.lifecycle('activate');assert.equal((await first.ready()).ready,true);
  const next=environment(first.shared,false);
  const page=await next.request('https://example.test/agenda-offline/?source=home');assert.equal(page.status,200);assert.match(await page.text(),/index.html/);
  for(const asset of ['styles.css','core.js','storage.js','app.js','manifest.webmanifest','icons/icon-192.png','icons/apple-touch-icon.png']){
    const response=await next.request('https://example.test/agenda-offline/'+asset,'same-origin');assert.equal(response.status,200,asset);
  }
  assert.equal(next.fetchCount(),0);assert.equal((await next.ready()).ready,true);
});
test('el módulo no intercepta otras rutas, APIs, POST ni orígenes',async()=>{
  const e=environment();await e.lifecycle('install');
  for(const url of ['https://example.test/','https://example.test/api/chat','https://example.test/agenda-offline-private/','https://example.test/agenda-offline/api/data','https://elsewhere.test/agenda-offline/'])assert.equal(await e.request(url),null,url);
  assert.equal(await e.request('https://example.test/agenda-offline/','navigate','POST'),null);
});
test('activar una versión solo limpia las cachés de su propia carpeta',async()=>{
  const e=environment();await e.lifecycle('install');e.shared.set('other-app-v1',new Map());e.shared.set('agenda-apuntes:/other/:0.9',new Map());e.shared.set('agenda-apuntes:/agenda-offline/:0.9',new Map());await e.lifecycle('activate');
  assert.equal(e.shared.has('other-app-v1'),true);assert.equal(e.shared.has('agenda-apuntes:/other/:0.9'),true);assert.equal(e.shared.has('agenda-apuntes:/agenda-offline/:0.9'),false);
});
test('no declara offline listo cuando falta un archivo; un fallo sin red devuelve 503',async()=>{
  const e=environment();await e.lifecycle('install');const entries=[...e.shared.values()][0];entries.delete('https://example.test/agenda-offline/styles.css');e.setOnline(false);
  assert.equal((await e.ready()).ready,false);assert.equal((await e.request('https://example.test/agenda-offline/styles.css','same-origin')).status,503);
});
test('la primera instalación no puede completarse sin conexión',async()=>{
  await assert.rejects(environment(new Map(),false).lifecycle('install'),/offline/);
});
