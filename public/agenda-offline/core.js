(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AgendaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const APP = 'agenda-apuntes';
  const MAX_ITEMS = 5000;
  const priorities = ['normal', 'alta', 'baja'];
  function uid() {
    return globalThis.crypto && globalThis.crypto.randomUUID
      ? globalThis.crypto.randomUUID()
      : 'a-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
  }
  function localDate(date = new Date()) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (y < 1900 || y > 2200) return null;
    const result = new Date(y, m - 1, d, 12);
    return localDate(result) === value ? result : null;
  }
  function plusDays(date, days) {
    const result = parseDate(date);
    if (!result) throw new Error('Fecha inválida.');
    result.setDate(result.getDate() + days);
    return localDate(result);
  }
  function week(date = localDate()) {
    const d = parseDate(date);
    const monday = plusDays(date, -((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => plusDays(monday, i));
  }
  function fold(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function matches(item, query) {
    const haystack = fold([item.title, item.course, item.body, item.details].filter(Boolean).join(' '));
    return fold(query).trim().split(/\s+/).every(term => haystack.includes(term));
  }
  function taskList(tasks, options = {}) {
    const { filter = 'all', day = localDate(), query = '', showDone = false } = options;
    const days = week(day);
    return tasks.filter(t => (showDone || !t.done) && matches(t, query) &&
      (filter === 'all' || (filter === 'day' && t.date === day) ||
      (filter === 'week' && days.includes(t.date)) || (filter === 'undated' && !t.date)))
      .sort((a, b) => Number(a.done) - Number(b.done) ||
        (a.date || '9999').localeCompare(b.date || '9999') ||
        ({ alta: 0, normal: 1, baja: 2 }[a.priority] - { alta: 0, normal: 1, baja: 2 }[b.priority]) ||
        (a.time || '99').localeCompare(b.time || '99') || b.updatedAt - a.updatedAt);
  }
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function string(value, max, label, required = false) {
    assert(typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0), label + ' no es válido.');
    return value;
  }
  function record(value, type) {
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Registro inválido.');
    const result = {
      id: string(value.id, 120, 'El identificador', true),
      title: string(value.title, 180, 'El título', type === 'tasks'),
      course: string(value.course, 60, 'El curso'),
      createdAt: value.createdAt,
      updatedAt: value.updatedAt
    };
    for (const k of ['createdAt', 'updatedAt']) assert(Number.isSafeInteger(result[k]) && result[k] >= 0 && result[k] <= 8640000000000000, 'Marca de tiempo inválida.');
    if (type === 'tasks') {
      result.date = string(value.date, 10, 'La fecha');
      assert(!result.date || parseDate(result.date), 'La fecha no existe.');
      result.time = string(value.time, 5, 'La hora');
      assert(!result.time || (/^([01]\d|2[0-3]):[0-5]\d$/.test(result.time) && result.date), 'La hora requiere una fecha válida.');
      assert(typeof value.done === 'boolean', 'Estado inválido.');
      assert(priorities.includes(value.priority), 'Prioridad inválida.');
      result.done = value.done;
      result.priority = value.priority;
      result.details = string(value.details, 4000, 'La descripción');
    } else {
      result.body = string(value.body, 100000, 'El apunte');
      assert(typeof value.pinned === 'boolean', 'Estado de fijado inválido.');
      result.pinned = value.pinned;
    }
    return result;
  }
  function validateBackup(data) {
    assert(data && data.app === APP && data.version === 1, 'Este archivo no es una copia compatible de Agenda y apuntes.');
    const result = { app: APP, version: 1, tasks: [], notes: [] };
    for (const type of ['tasks', 'notes']) {
      assert(Array.isArray(data[type]) && data[type].length <= MAX_ITEMS, 'La copia supera el límite de ' + MAX_ITEMS + ' registros por tipo.');
      const seen = new Set();
      result[type] = data[type].map(item => {
        const clean = record(item, type);
        assert(!seen.has(clean.id), 'La copia contiene identificadores duplicados.');
        seen.add(clean.id);
        return clean;
      });
    }
    return result;
  }
  function backup(tasks, notes) {
    return { ...validateBackup({ app: APP, version: 1, tasks, notes }), exportedAt: new Date().toISOString() };
  }
  return { APP, MAX_ITEMS, uid, localDate, parseDate, plusDays, week, fold, matches, taskList, record, validateBackup, backup };
});
