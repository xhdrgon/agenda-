'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/agenda-offline/core.js');
function task(changes = {}) { return { id: 't1', title: 'Revisar Física', course: 'Física', date: '2026-10-12', time: '09:00', done: false, priority: 'normal', details: '', createdAt: 1, updatedAt: 1, ...changes }; }
function note(changes = {}) { return { id: 'n1', title: 'Calorimetría', body: 'Q = m c ΔT\nRepasar ejemplos.', course: 'Física', pinned: false, createdAt: 1, updatedAt: 1, ...changes }; }
test('fechas locales: semana cruza año y febrero respeta años bisiestos', () => {
  assert.deepEqual(C.week('2026-01-01'), ['2025-12-29','2025-12-30','2025-12-31','2026-01-01','2026-01-02','2026-01-03','2026-01-04']);
  assert.equal(C.plusDays('2024-02-28', 1), '2024-02-29');
  assert.equal(C.plusDays('2026-02-28', 1), '2026-03-01');
  assert.equal(C.parseDate('2026-02-30'), null);
  assert.equal(C.localDate(new Date(2026, 9, 11, 23, 59)), '2026-10-11');
});
test('filtros de día, semana, sin fecha, estado y búsqueda con tildes', () => {
  const items = [task(), task({ id:'t2', title:'Álgebra', course:'Matemática', date:'', time:'' }), task({ id:'t3', done:true }), task({ id:'t4', date:'2026-10-21' })];
  assert.equal(C.taskList(items).length, 3);
  assert.deepEqual(C.taskList(items, { filter:'day', day:'2026-10-12' }).map(t=>t.id), ['t1']);
  assert.equal(C.taskList(items, { filter:'week', day:'2026-10-12', showDone:true }).length, 2);
  assert.equal(C.taskList(items, { filter:'undated' })[0].id, 't2');
  assert.equal(C.taskList(items, { query:'algebra matematica' })[0].id, 't2');
  assert.equal(C.matches(note(), 'calorimetria repasar'), true);
});
test('copia de ida y vuelta conserva texto, saltos, fechas y estado', () => {
  const tasks=[task()], notes=[note({body:'Texto <script> y & símbolos 📝\nSegunda línea'})];
  const result=C.validateBackup(JSON.parse(JSON.stringify(C.backup(tasks,notes))));
  assert.deepEqual(result.tasks,tasks); assert.deepEqual(result.notes,notes);
});
test('validación rechaza copias corruptas antes de escribir y elimina campos ajenos', () => {
  const bad = [ {app:'otro',version:1,tasks:[],notes:[]}, {app:C.APP,version:2,tasks:[],notes:[]}, {app:C.APP,version:1,tasks:[task({date:'2026-02-31'})],notes:[]}, {app:C.APP,version:1,tasks:[task({date:'',time:'09:00'})],notes:[]}, {app:C.APP,version:1,tasks:[task({time:'24:10'})],notes:[]}, {app:C.APP,version:1,tasks:[task(),task()],notes:[]}, {app:C.APP,version:1,tasks:[],notes:[note({body:'a'.repeat(100001)})]}, {app:C.APP,version:1,tasks:[task({done:'false'})],notes:[]} ];
  for(const data of bad) assert.throws(()=>C.validateBackup(data));
  const clean = C.record({...task(), extra:'no', __proto__:{polluted:true}}, 'tasks');
  assert.equal(clean.extra,undefined); assert.equal(clean.polluted,undefined);
});
test('prioridad, fechas y completadas ordenan resultados de forma predecible',()=>{
  const result=C.taskList([task({id:'b',priority:'baja'}),task({id:'a',priority:'alta'}),task({id:'z',date:'',time:''}),task({id:'d',done:true})],{showDone:true});
  assert.deepEqual(result.map(t=>t.id),['a','b','z','d']);
});
