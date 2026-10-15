(function () {
  'use strict';
  const C = window.AgendaCore;
  const DB = window.AgendaDB;
  const $ = id => document.getElementById(id);
  const base = new URL('./', location.href);
  const settingsKey = 'agenda-apuntes:settings:' + base.pathname;
  const state = {
    tasks: [], notes: [], day: C.localDate(), filter: 'all', view: 'agenda',
    selectedNote: null, dirty: false, revision: 0, ready: false
  };
  let saveTimer, toastTimer, serial = Promise.resolve(), pendingWrites = 0;
  let taskEditingId = null, confirmCallback = null, installPrompt = null;
  let checkingOffline = false, registration = null;

  function icon(name, className = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon ' + className);
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.append(use);
    return svg;
  }
  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
  }
  function report(error) {
    $('errorText').textContent = (error && error.message ? error.message : 'No se pudo completar la acción.') + ' No cierres la app si tienes cambios sin guardar.';
    $('storageError').hidden = false;
    const dialogs = document.querySelectorAll('dialog[open]');
    const active = dialogs[dialogs.length - 1];
    if (active) {
      let message = active.querySelector('.dialog-error');
      if (!message) { message = node('p', 'dialog-error'); message.setAttribute('role', 'alert'); active.querySelector('.dialog-heading').after(message); }
      message.textContent = $('errorText').textContent;
    }
    updateSaveStatus('failed');
  }
  function clearError() { $('storageError').hidden = true; document.querySelectorAll('.dialog-error').forEach(message => message.remove()); }
  async function guarded(fn) { try { await fn(); } catch (error) { report(error); } }
  function write(job) {
    pendingWrites++;
    const result = serial.then(job);
    serial = result.catch(() => {}).finally(() => { pendingWrites--; });
    return result;
  }
  function showDialog(id) {
    const dialog = $(id);
    if (dialog.open) return;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  function closeDialog(id) {
    const dialog = $(id);
    if (dialog.close) dialog.close();
    else dialog.removeAttribute('open');
  }
  function ask(title, message, action, callback) {
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = message;
    $('confirmAction').textContent = action;
    confirmCallback = callback;
    showDialog('confirmDialog');
  }
  function dateText(date, options) {
    const parsed = C.parseDate(date);
    return parsed ? new Intl.DateTimeFormat('es-PE', options || { day: 'numeric', month: 'short' }).format(parsed) : 'Sin fecha';
  }
  function dateLabel(date) {
    if (!date) return 'Sin fecha';
    const today = C.localDate();
    if (date === today) return 'Hoy';
    if (date === C.plusDays(today, 1)) return 'Mañana';
    if (date === C.plusDays(today, -1)) return 'Ayer';
    return dateText(date, { day: 'numeric', month: 'short', ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) });
  }
  function updateHeader() {
    $('todayLabel').textContent = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date());
    $('taskCount').textContent = state.tasks.filter(task => !task.done).length;
    $('noteCount').textContent = state.notes.length;
  }
  function renderWeek() {
    const days = C.week(state.day);
    $('weekLabel').textContent = dateText(days[0], { month: 'long', year: 'numeric' });
    if (days[0].slice(0, 7) !== days[6].slice(0, 7)) $('weekLabel').textContent = dateText(days[0]) + ' – ' + dateText(days[6]);
    const frag = document.createDocumentFragment();
    for (const day of days) {
      const button = node('button', 'day-button' + (day === C.localDate() ? ' today' : ''));
      button.type = 'button';
      button.dataset.day = day;
      button.setAttribute('aria-pressed', String(day === state.day));
      const count = state.tasks.filter(task => !task.done && task.date === day).length;
      button.setAttribute('aria-label', dateText(day, { weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + count + ' tareas pendientes');
      if (day === C.localDate()) button.setAttribute('aria-current', 'date');
      button.append(node('span', '', dateText(day, { weekday: 'short' }).replace('.', '')), node('strong', '', C.parseDate(day).getDate()), node('span', 'day-marker' + (count ? ' has-tasks' : '')));
      frag.append(button);
    }
    $('weekStrip').replaceChildren(frag);
  }
  function renderSummary() {
    const days = C.week();
    const tasks = state.tasks.filter(task => days.includes(task.date));
    const completed = tasks.filter(task => task.done).length;
    $('progressText').textContent = completed + ' de ' + tasks.length;
    $('weekProgress').max = tasks.length || 1;
    $('weekProgress').value = completed;
    $('todayCount').textContent = state.tasks.filter(task => !task.done && task.date === C.localDate()).length;
    $('overdueCount').textContent = state.tasks.filter(task => !task.done && task.date && task.date < C.localDate()).length;
  }
  function renderTasks() {
    const list = C.taskList(state.tasks, { filter: state.filter, day: state.day, query: $('taskSearch').value, showDone: $('showDone').checked });
    $('taskListTitle').textContent = { all: $('showDone').checked ? 'Todas tus tareas' : 'Tus pendientes', day: dateText(state.day, { weekday: 'long', day: 'numeric', month: 'long' }), week: 'Semana seleccionada', undated: 'Sin fecha, sin olvido' }[state.filter];
    $('visibleCount').textContent = list.length + (list.length === 1 ? ' tarea' : ' tareas');
    const frag = document.createDocumentFragment();
    for (const task of list) {
      const row = node('article', 'task-row' + (task.done ? ' done' : ''));
      const check = node('button', 'task-check');
      check.dataset.toggle = task.id;
      check.setAttribute('aria-pressed', String(task.done));
      check.setAttribute('aria-label', (task.done ? 'Marcar como pendiente: ' : 'Completar: ') + task.title);
      const visual = node('span', 'checkbox-visual'); visual.append(icon('check')); check.append(visual);
      const edit = node('button', 'task-edit');
      edit.dataset.editTask = task.id;
      edit.setAttribute('aria-label', 'Editar tarea: ' + task.title);
      edit.append(node('span', 'task-title', task.title));
      const meta = node('span', 'task-meta');
      if (task.course) meta.append(node('span', 'course-pill', task.course));
      const late = !task.done && task.date && task.date < C.localDate();
      meta.append(node('span', late ? 'late' : '', dateLabel(task.date) + (task.time ? ' · ' + task.time : '') + (late ? ' · atrasada' : '')));
      edit.append(meta);
      row.append(check, edit);
      if (task.priority !== 'normal') row.append(node('span', 'priority-tag ' + task.priority, task.priority));
      row.append(icon('arrow'));
      frag.append(row);
    }
    $('taskList').replaceChildren(frag);
    $('taskEmpty').hidden = list.length !== 0;
    if (!state.tasks.length) {
      $('emptyTaskTitle').textContent = 'Tu agenda empieza contigo';
      $('emptyTaskText').textContent = 'Anota una entrega, una lectura o algo que no quieras olvidar.';
    } else {
      $('emptyTaskTitle').textContent = $('taskSearch').value.trim() ? 'No hay coincidencias' : 'Todo despejado por aquí';
      $('emptyTaskText').textContent = $('taskSearch').value.trim() ? 'Prueba con otro título o curso.' : 'No hay pendientes con estos filtros. Puedes ver otras fechas o las tareas hechas.';
    }
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.classList.toggle('selected', button.dataset.filter === state.filter);
      button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
    });
    updateHeader(); renderWeek(); renderSummary();
  }
  function openTask(id) {
    if (!state.ready) return notify('El almacenamiento aún no está disponible.');
    if (!id && state.tasks.length >= C.MAX_ITEMS) return notify('El prototipo admite hasta ' + C.MAX_ITEMS + ' tareas. Exporta una copia antes de hacer espacio.');
    taskEditingId = id || null;
    const task = state.tasks.find(item => item.id === id);
    $('taskForm').reset();
    $('taskDialogTitle').textContent = task ? 'Editar tarea' : 'Nueva tarea';
    $('taskTitle').value = task ? task.title : '';
    $('taskCourse').value = task ? task.course : '';
    $('taskDate').value = task ? task.date : (state.filter === 'undated' ? '' : state.day);
    $('taskTime').value = task ? task.time : '';
    $('taskTime').disabled = !$('taskDate').value;
    $('taskPriority').value = task ? task.priority : 'normal';
    $('taskDetails').value = task ? task.details : '';
    $('deleteTask').hidden = !task;
    $('taskFormError').hidden = true;
    showDialog('taskDialog');
    $('taskTitle').focus();
  }
  async function saveTask(event) {
    event.preventDefault();
    if (!$('taskForm').reportValidity() || $('saveTask').disabled) return;
    $('saveTask').disabled = true;
    const old = state.tasks.find(item => item.id === taskEditingId);
    const now = Date.now();
    try {
      const task = C.record({ id: old ? old.id : C.uid(), title: $('taskTitle').value.trim(), course: $('taskCourse').value.trim(), date: $('taskDate').value, time: $('taskDate').value ? $('taskTime').value : '', priority: $('taskPriority').value, details: $('taskDetails').value, done: old ? old.done : false, createdAt: old ? old.createdAt : now, updatedAt: now }, 'tasks');
      await write(() => DB.put('tasks', task));
      if (old) state.tasks = state.tasks.map(item => item.id === task.id ? task : item);
      else state.tasks.push(task);
      clearError(); closeDialog('taskDialog'); renderTasks();
      notify(old ? 'Tarea actualizada.' : 'Tarea guardada en este dispositivo.');
    } catch (error) {
      $('taskFormError').textContent = error.message;
      $('taskFormError').hidden = false;
    } finally { $('saveTask').disabled = false; }
  }
  async function toggleTask(button, id) {
    const task = state.tasks.find(item => item.id === id);
    if (!task || button.disabled) return;
    button.disabled = true;
    try {
      const next = { ...task, done: !task.done, updatedAt: Date.now() };
      await write(() => DB.put('tasks', next));
      state.tasks = state.tasks.map(item => item.id === id ? next : item);
      clearError(); renderTasks();
      notify(next.done ? 'Una tarea menos. Bien ahí.' : 'Tarea marcada como pendiente.');
    } finally { button.disabled = false; }
  }
  function renderNoteList() {
    const notes = state.notes.filter(note => C.matches(note, $('noteSearch').value))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
    $('filteredNotesCount').textContent = notes.length;
    const frag = document.createDocumentFragment();
    for (const note of notes) {
      const button = node('button', 'note-card' + (state.selectedNote === note.id ? ' selected' : ''));
      button.dataset.note = note.id;
      button.setAttribute('aria-pressed', String(state.selectedNote === note.id));
      const heading = node('span', 'note-card-heading');
      heading.append(node('strong', '', note.title.trim() || 'Apunte sin título'));
      if (note.pinned) { const pin = icon('pin'); pin.setAttribute('aria-label', 'Fijado'); pin.removeAttribute('aria-hidden'); heading.append(pin); }
      button.append(heading, node('span', 'note-preview', note.body.trim() || 'Empieza a escribir…'), node('span', 'note-date', (note.course ? note.course + ' · ' : '') + new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(new Date(note.updatedAt))));
      frag.append(button);
    }
    $('noteList').replaceChildren(frag);
    $('noteListEmpty').hidden = notes.length !== 0;
    $('noteListEmpty').textContent = state.notes.length ? 'No hay apuntes con esa búsqueda.' : 'Todavía no hay apuntes. El primero puede empezar con una sola idea.';
    updateHeader();
  }
  function currentNote() { return state.notes.find(note => note.id === state.selectedNote); }
  function updateSaveStatus(mode) {
    const status = $('saveStatus');
    status.className = 'save-status';
    if (mode === 'failed') { status.classList.add('failed'); status.textContent = 'No se pudo guardar'; }
    else if (state.dirty || mode === 'saving') { status.classList.add('dirty'); status.textContent = mode === 'saving' ? 'Guardando…' : 'Cambios sin guardar'; }
    else status.textContent = 'Guardado en este dispositivo';
  }
  function updateEditorMeta() {
    const note = currentNote();
    if (!note) return;
    const count = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
    $('wordCount').textContent = count + (count === 1 ? ' palabra' : ' palabras');
    $('pinNote').setAttribute('aria-pressed', String(note.pinned));
    $('pinNote').setAttribute('aria-label', note.pinned ? 'Desfijar apunte' : 'Fijar apunte');
  }
  function showNoteEditor() {
    const note = currentNote();
    $('noteEditor').hidden = !note;
    $('notePlaceholder').hidden = !!note;
    $('notesLayout').classList.toggle('editing', !!note);
    if (note) {
      $('noteTitle').value = note.title;
      $('noteCourse').value = note.course;
      $('noteBody').value = note.body;
      updateEditorMeta(); updateSaveStatus();
    }
    renderNoteList();
  }
  async function flushNote() {
    clearTimeout(saveTimer);
    if (!state.dirty) return true;
    const note = currentNote();
    if (!note) return true;
    const snapshot = { ...note };
    const revision = state.revision;
    updateSaveStatus('saving');
    try {
      await write(() => DB.put('notes', C.record(snapshot, 'notes')));
      if (state.selectedNote === snapshot.id && state.revision === revision) state.dirty = false;
      clearError(); updateSaveStatus();
      if (state.dirty) saveTimer = setTimeout(() => { void flushNote(); }, 350);
      return !state.dirty;
    } catch (error) { report(error); return false; }
  }
  function changedNote() {
    const note = currentNote();
    if (!note) return;
    note.title = $('noteTitle').value;
    note.course = $('noteCourse').value;
    note.body = $('noteBody').value;
    note.updatedAt = Math.max(Date.now(), note.updatedAt + 1);
    state.revision++;
    state.dirty = true;
    updateSaveStatus(); updateEditorMeta(); renderNoteList();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void flushNote(); }, 400);
  }
  async function openNote(id) {
    if (id !== state.selectedNote && !(await flushNote())) return;
    state.selectedNote = id;
    showNoteEditor();
  }
  async function createNote() {
    if (!state.ready) return notify('El almacenamiento aún no está disponible.');
    if (state.notes.length >= C.MAX_ITEMS) return notify('El prototipo admite hasta ' + C.MAX_ITEMS + ' apuntes. Exporta una copia antes de hacer espacio.');
    if (!(await flushNote())) return;
    const now = Date.now();
    const note = { id: C.uid(), title: '', body: '', course: '', pinned: false, createdAt: now, updatedAt: now };
    await write(() => DB.put('notes', note));
    state.notes.push(note);
    state.selectedNote = note.id;
    await switchView('notes');
    showNoteEditor(); clearError(); $('noteTitle').focus();
  }
  async function switchView(view) {
    if (!(await flushNote())) return;
    state.view = view === 'notes' ? 'notes' : 'agenda';
    $('agendaView').hidden = state.view !== 'agenda';
    $('notesView').hidden = state.view !== 'notes';
    document.querySelectorAll('[data-view]').forEach(button => {
      const selected = button.dataset.view === state.view;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    history.replaceState(null, '', '#' + state.view);
    if (state.view === 'notes') renderNoteList(); else renderTasks();
  }
  function download(contents, filename, mime) {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = node('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function exportBackup() {
    if (!(await flushNote())) return;
    await serial;
    const data = await DB.getAll();
    download(JSON.stringify(C.backup(data.tasks, data.notes), null, 2), 'Agenda-y-apuntes-' + C.localDate() + '.json', 'application/json;charset=utf-8');
    const message = 'Copia preparada: ' + data.tasks.length + ' tareas y ' + data.notes.length + ' apuntes. Comprueba que el archivo se haya guardado en Descargas o Archivos.';
    $('backupStatus').textContent = message; notify('Copia preparada para descargar.');
  }
  async function importFile(file) {
    if (!file) return;
    if (!(await flushNote())) return;
    if (file.size > 10 * 1024 * 1024) throw new Error('La copia supera los 10 MB permitidos.');
    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch (_) { throw new Error('No se pudo leer el JSON. Elige una copia exportada por esta agenda.'); }
    const data = C.validateBackup(parsed);
    const existing = await DB.getAll();
    for (const type of ['tasks', 'notes']) {
      const ids = new Set(existing[type].map(item => item.id));
      data[type].forEach(item => ids.add(item.id));
      if (ids.size > C.MAX_ITEMS) throw new Error('La importación superaría el límite de ' + C.MAX_ITEMS + ' registros por tipo.');
    }
    closeDialog('settingsDialog');
    ask('Importar esta copia', 'El archivo contiene ' + data.tasks.length + ' tareas y ' + data.notes.length + ' apuntes.\n\nSe añadirán los registros que falten. Si un identificador ya existe, se conservará la versión que tienes en este dispositivo. No se reemplaza ni se borra contenido.', 'Importar', async () => {
      const count = await write(() => DB.importMissing(data));
      const refreshed = await DB.getAll();
      state.tasks = refreshed.tasks; state.notes = refreshed.notes;
      renderTasks(); showNoteEditor(); clearError();
      $('backupStatus').textContent = count.added + ' registros añadidos; ' + count.skipped + ' ya existentes conservados.';
      notify($('backupStatus').textContent);
    });
  }
  function theme(mode) {
    document.documentElement.dataset.theme = mode;
    $('themeButton').setAttribute('aria-label', mode === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro');
    try { localStorage.setItem(settingsKey, JSON.stringify({ theme: mode })); } catch (_) { /* Content persistence is handled separately in IndexedDB. */ }
  }
  function offlineStatus(ready, detail) {
    $('offlineBadge').classList.toggle('ready', ready);
    $('offlineText').textContent = ready ? (navigator.onLine ? 'Lista sin conexión' : 'Sin conexión · lista') : (navigator.onLine ? 'Offline por preparar' : 'Offline no verificado');
    $('offlineDetail').textContent = detail;
  }
  async function waitActive(reg) {
    if (reg.active) return reg.active;
    const worker = reg.installing || reg.waiting;
    if (!worker) throw new Error('La instalación aún no está lista.');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { worker.removeEventListener('statechange', listener); reject(new Error('La preparación está tardando. Mantén la conexión y comprueba de nuevo.')); }, 15000);
      function listener() {
        if (worker.state === 'activated') { clearTimeout(timer); worker.removeEventListener('statechange', listener); resolve(worker); }
        else if (worker.state === 'redundant') { clearTimeout(timer); worker.removeEventListener('statechange', listener); reject(new Error('No se descargaron todos los archivos. Comprueba la conexión e inténtalo otra vez.')); }
      }
      worker.addEventListener('statechange', listener); listener();
    });
  }
  async function askWorker(worker) {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('No se pudo verificar la copia offline.')); }, 5000);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
      worker.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]);
    });
  }
  async function verifyOffline(register = false) {
    if (checkingOffline) return;
    checkingOffline = true;
    $('retryOffline').disabled = true;
    try {
      if (!window.isSecureContext || !('serviceWorker' in navigator) || location.protocol === 'file:') {
        throw new Error('Para preparar el modo offline abre la app desde el alojamiento con HTTPS o desde localhost. Abrir el archivo HTML directamente no permite instalarla.');
      }
      if (!registration || register) {
        const old = await navigator.serviceWorker.getRegistration(base.href);
        try { registration = await navigator.serviceWorker.register(new URL('sw.js', base).href, { scope: base.href, updateViaCache: 'none' }); }
        catch (error) { if (old && old.scope === base.href) registration = old; else throw error; }
      }
      const worker = await waitActive(registration);
      const result = await askWorker(worker);
      const controller = navigator.serviceWorker.controller;
      const controlsThisPage = controller && controller.scriptURL === worker.scriptURL;
      if (!controlsThisPage) {
        offlineStatus(false, 'La copia se preparó. Vuelve a abrir esta página con conexión para activar su uso offline.');
      } else if (result.ready) {
        offlineStatus(true, 'La aplicación está guardada para abrirse sin internet. Puedes crear y editar tareas y apuntes. Recuerda exportar tus copias.');
      } else {
        offlineStatus(false, 'Faltan archivos de la copia offline. Vuelve a abrirla con internet para recuperarlos y comprueba de nuevo.');
      }
      if (registration.waiting) $('offlineDetail').textContent += ' Hay una actualización lista; cierra todas las pestañas y la app para activarla al volver a abrir.';
    } catch (error) { offlineStatus(false, error.message || 'No se pudo preparar la app. Comprueba la conexión y el alojamiento.'); }
    finally { checkingOffline = false; $('retryOffline').disabled = false; }
  }
  async function storageInfo() {
    if (!navigator.storage || !navigator.storage.persisted) {
      $('storageState').textContent = 'Este navegador decide cuánto tiempo conserva los datos. Exporta copias.';
      $('protectStorage').hidden = true; return;
    }
    try {
      const persisted = await navigator.storage.persisted();
      $('storageState').textContent = persisted ? 'Almacenamiento persistente concedido. Mantén tus copias de seguridad.' : 'Almacenamiento local estándar. Exporta copias con frecuencia.';
      $('protectStorage').hidden = persisted || !navigator.storage.persist;
    } catch (_) { $('storageState').textContent = 'No se pudo consultar la protección del almacenamiento.'; }
  }
  async function settings() {
    if (!(await flushNote())) return;
    showDialog('settingsDialog');
    void verifyOffline(); void storageInfo();
  }
  async function loadData() {
    document.body.classList.add('app-loading');
    try {
      const data = await DB.getAll();
      state.tasks = data.tasks; state.notes = data.notes;
      state.ready = true; clearError(); renderTasks(); renderNoteList();
    } catch (error) { state.ready = false; report(error); }
    finally { document.body.classList.remove('app-loading'); }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.close) closeDialog(button.dataset.close);
    else if (button.dataset.view) void guarded(() => switchView(button.dataset.view));
    else if (button.dataset.action === 'settings') void guarded(settings);
    else if (button.dataset.day) { state.day = button.dataset.day; state.filter = 'day'; renderTasks(); }
    else if (button.dataset.filter) { state.filter = button.dataset.filter; renderTasks(); }
    else if (button.dataset.toggle) void guarded(() => toggleTask(button, button.dataset.toggle));
    else if (button.dataset.editTask) openTask(button.dataset.editTask);
    else if (button.dataset.note) void guarded(() => openNote(button.dataset.note));
  });
  for (const id of ['newTask', 'emptyAddTask']) $(id).addEventListener('click', () => openTask());
  for (const id of ['newNote', 'emptyAddNote', 'quickNote']) $(id).addEventListener('click', () => { void guarded(createNote); });
  $('taskForm').addEventListener('submit', saveTask);
  $('taskDate').addEventListener('change', () => { $('taskTime').disabled = !$('taskDate').value; if (!$('taskDate').value) $('taskTime').value = ''; });
  $('taskSearch').addEventListener('input', renderTasks);
  $('noteSearch').addEventListener('input', renderNoteList);
  $('showDone').addEventListener('change', renderTasks);
  $('prevWeek').addEventListener('click', () => { state.day = C.plusDays(state.day, -7); state.filter = 'week'; renderTasks(); });
  $('nextWeek').addEventListener('click', () => { state.day = C.plusDays(state.day, 7); state.filter = 'week'; renderTasks(); });
  $('goToday').addEventListener('click', () => { state.day = C.localDate(); state.filter = 'day'; renderTasks(); });
  for (const id of ['noteTitle', 'noteCourse', 'noteBody']) $(id).addEventListener('input', changedNote);
  $('saveNoteNow').addEventListener('click', () => { void guarded(async () => { if (await flushNote()) notify('Apunte guardado en este dispositivo.'); }); });
  $('backToNotes').addEventListener('click', () => { void guarded(async () => { if (await flushNote()) { $('notesLayout').classList.remove('editing'); renderNoteList(); } }); });
  $('pinNote').addEventListener('click', () => { void guarded(async () => {
    const note = currentNote(); if (!note) return;
    note.pinned = !note.pinned; changedNote(); await flushNote();
  }); });
  $('downloadNote').addEventListener('click', () => { void guarded(async () => {
    if (!(await flushNote())) return;
    const note = currentNote(); if (!note) return;
    const title = note.title.trim() || 'Apunte sin título';
    const filename = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 80) + '.txt';
    download(title + '\n' + (note.course ? note.course + '\n' : '') + '\n' + note.body, filename, 'text/plain;charset=utf-8');
  }); });
  $('deleteTask').addEventListener('click', () => {
    const task = state.tasks.find(item => item.id === taskEditingId); if (!task) return;
    closeDialog('taskDialog');
    ask('Eliminar tarea', 'Se eliminará «' + task.title + '» de este dispositivo.', 'Eliminar', async () => {
      await write(() => DB.remove('tasks', task.id));
      state.tasks = state.tasks.filter(item => item.id !== task.id); renderTasks(); notify('Tarea eliminada.');
    });
  });
  $('deleteNote').addEventListener('click', () => {
    const note = currentNote(); if (!note) return;
    ask('Eliminar apunte', 'Se eliminará «' + (note.title.trim() || 'Apunte sin título') + '» de este dispositivo. Exporta una copia antes si quieres conservarlo.', 'Eliminar', async () => {
      clearTimeout(saveTimer);
      await write(() => DB.remove('notes', note.id));
      state.notes = state.notes.filter(item => item.id !== note.id);
      if (state.selectedNote === note.id) { state.selectedNote = null; state.dirty = false; }
      clearError(); showNoteEditor(); notify('Apunte eliminado.');
    });
  });
  $('confirmAction').addEventListener('click', () => { void guarded(async () => {
    const action = confirmCallback;
    if (!action || $('confirmAction').disabled) return;
    $('confirmAction').disabled = true;
    try { await action(); confirmCallback = null; closeDialog('confirmDialog'); }
    finally { $('confirmAction').disabled = false; }
  }); });
  $('exportBackup').addEventListener('click', () => { void guarded(exportBackup); });
  $('chooseImport').addEventListener('click', () => { $('importFile').click(); });
  $('importFile').addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; void guarded(() => importFile(file)); });
  $('retrySave').addEventListener('click', () => { void guarded(async () => { if (state.dirty) await flushNote(); else await loadData(); }); });
  $('retryOffline').addEventListener('click', () => { void verifyOffline(true); });
  $('themeButton').addEventListener('click', () => { theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); });
  $('protectStorage').addEventListener('click', () => { void guarded(async () => {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      notify(granted ? 'Almacenamiento persistente concedido.' : 'El navegador no lo concedió. Puedes seguir usando la agenda y exportar copias.');
      await storageInfo();
    }
  }); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('installApp').hidden = false; });
  $('installApp').addEventListener('click', () => { void guarded(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('installApp').hidden = true;
  }); });
  window.addEventListener('appinstalled', () => { installPrompt = null; $('installApp').hidden = true; notify('Agenda instalada. Ábrela y comprueba su estado offline.'); });
  window.addEventListener('online', () => { void verifyOffline(); });
  window.addEventListener('offline', () => { void verifyOffline(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => { setTimeout(() => { void verifyOffline(); }, 100); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { void flushNote(); }
    else { updateHeader(); renderTasks(); void verifyOffline(); }
  });
  window.addEventListener('beforeunload', event => {
    if (state.dirty || pendingWrites) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('hashchange', () => { void guarded(() => switchView(location.hash === '#notes' ? 'notes' : 'agenda')); });
  document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); void guarded(() => switchView('agenda')); });
  try { const preferences = JSON.parse(localStorage.getItem(settingsKey)); theme(preferences && preferences.theme === 'dark' ? 'dark' : 'light'); } catch (_) { theme('light'); }
  void (async () => { await loadData(); await switchView(location.hash === '#notes' ? 'notes' : 'agenda'); void verifyOffline(true); })();
})();
