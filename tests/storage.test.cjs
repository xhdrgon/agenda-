'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createDB = require('../public/agenda-offline/storage.js');
// Controlled IndexedDB contract double: request success and transaction commit
// are deliberately separate, so a premature "saved" result is detected.
function harness() {
  const stores = { tasks:new Map(), notes:new Map() };
  let tx, db, openName;
  const api = { open(name) {
    openName = name;
    const request = {};
    queueMicrotask(() => {
      db = { transaction(names,mode) {
        const result = {mode, names, pending:[], objectStore(name) {
          const data=stores[name];
          return {
            put(value) { result.pending.push(()=>data.set(value.id,structuredClone(value))); return {}; },
            add(value) { result.pending.push(()=>{ if(data.has(value.id)) throw new Error('duplicate');data.set(value.id,structuredClone(value)); });return {}; },
            delete(id) {result.pending.push(()=>data.delete(id));return {};},
            getAll() { return {result:[...data.values()].map(item=>structuredClone(item))}; },
            get(id) { const request={};queueMicrotask(()=>{request.result=data.get(id);request.onsuccess();});return request; }
          };
        },abort() {result.error=new Error('abort');result.onabort();} };
        tx=result; return result;
      }, close(){} };
      request.result=db;request.onsuccess();
    });
    return request;
  }};
  return { instance:createDB(api,'/agenda-offline/'), stores, tx:()=>tx, name:()=>openName, commit() { for(const fn of tx.pending) fn();tx.oncomplete(); } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('no confirma guardado hasta completar la transacción',async()=>{
  const h=harness();let saved=false;
  const p=h.instance.put('notes',{id:'one',body:'Texto'}).then(()=>{saved=true});
  await tick();assert.equal(saved,false);assert.equal(h.stores.notes.size,0);
  h.commit();await p;assert.equal(saved,true);assert.equal(h.stores.notes.get('one').body,'Texto');
  assert.equal(h.name(),'agenda-apuntes-v1:/agenda-offline/');
});
test('abortos y falta de espacio se propagan como fallo, sin confirmar escritura',async()=>{
  const h=harness();const p=h.instance.put('tasks',{id:'one'});const rejected=assert.rejects(p,/Quota/);
  await tick();h.tx().error=new Error('Quota exceeded');h.tx().onabort();await rejected;
  assert.equal(h.stores.tasks.size,0);
});
test('importación añade lo nuevo y conserva registros existentes en una sola transacción',async()=>{
  const h=harness();h.stores.notes.set('one',{id:'one',body:'Versión local'});
  const p=h.instance.importMissing({tasks:[{id:'t'}],notes:[{id:'one',body:'Versión externa'},{id:'two',body:'Nuevo'}]});
  await tick();assert.deepEqual(h.tx().names,['tasks','notes']);h.commit();
  assert.deepEqual(await p,{added:2,skipped:1});assert.equal(h.stores.notes.get('one').body,'Versión local');assert.equal(h.stores.notes.get('two').body,'Nuevo');
});
test('eliminación solo se confirma tras commit',async()=>{
  const h=harness();h.stores.tasks.set('t',{id:'t'});const p=h.instance.remove('tasks','t');
  await tick();assert.equal(h.stores.tasks.size,1);h.commit();await p;assert.equal(h.stores.tasks.size,0);
});
test('lectura devuelve las tareas y los apuntes previamente guardados',async()=>{
  const h=harness();
  const t={id:'t',title:'Tarea local'},n={id:'n',body:'Apunte local'};
  const saveTask=h.instance.put('tasks',t);await tick();h.commit();await saveTask;
  const saveNote=h.instance.put('notes',n);await tick();h.commit();await saveNote;
  const read=h.instance.getAll();await tick();h.commit();
  assert.deepEqual(await read,{tasks:[t],notes:[n]});
});
test('si IndexedDB no existe se informa del bloqueo',async()=>{
  await assert.rejects(createDB(undefined,'/').getAll(),/no permite guardar/);
});
