(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.AgendaDB = factory(root.indexedDB, new URL('./', root.location.href).pathname);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (indexedDB, scope) {
  'use strict';
  let opening;
  const databaseName = 'agenda-apuntes-v1:' + scope;
  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(new Error('Este navegador no permite guardar datos locales.')); return; }
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        for (const name of ['tasks', 'notes']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento.'));
      request.onblocked = () => reject(new Error('Cierra las otras pestañas de la agenda y vuelve a abrirla.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  async function transaction(stores, mode, callback) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let output;
      tx.oncomplete = () => resolve(typeof output === 'function' ? output() : output);
      tx.onerror = () => reject(tx.error || new Error('No se pudo guardar. El almacenamiento podría estar lleno.'));
      tx.onabort = () => reject(tx.error || new Error('El cambio no llegó a guardarse.'));
      try { output = callback(tx); } catch (error) { tx.abort(); reject(error); }
    });
  }
  function getAll() {
    return transaction(['tasks', 'notes'], 'readonly', tx => {
      const tasks = tx.objectStore('tasks').getAll();
      const notes = tx.objectStore('notes').getAll();
      return () => ({ tasks: tasks.result, notes: notes.result });
    });
  }
  function put(type, item) { return transaction([type], 'readwrite', tx => { tx.objectStore(type).put(item); }); }
  function remove(type, id) { return transaction([type], 'readwrite', tx => { tx.objectStore(type).delete(id); }); }
  function importMissing(data) {
    return transaction(['tasks', 'notes'], 'readwrite', tx => {
      const count = { added: 0, skipped: 0 };
      for (const type of ['tasks', 'notes']) {
        const store = tx.objectStore(type);
        for (const item of data[type]) {
          const request = store.get(item.id);
          request.onsuccess = () => {
            if (request.result) count.skipped++;
            else { store.add(item); count.added++; }
          };
        }
      }
      return () => count;
    });
  }
  return { open, getAll, put, remove, importMissing };
});
