// IndexedDB comum à página e ao service worker (script clássico: o Firefox não tem service worker em módulo).
// "recebidos" guarda cada aviso que acordou o service worker; "contatos" simula o banco local do app, para medir se
// o service worker acha o nome do contato sem que o nome vá no aviso.

self.banco = (() => {
  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('lerolero-push', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('recebidos', { keyPath: 'id' })
        req.result.createObjectStore('contatos', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async function run(store, mode, fn) {
    const db = await open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode)
      const req = fn(tx.objectStore(store))
      tx.oncomplete = () => resolve(req?.result)
      tx.onerror = () => reject(tx.error)
    })
  }

  return {
    put: (store, value) => run(store, 'readwrite', (s) => s.put(value)),
    get: (store, id) => run(store, 'readonly', (s) => s.get(id)),
    all: (store) => run(store, 'readonly', (s) => s.getAll()),
    clear: (store) => run(store, 'readwrite', (s) => s.clear()),
  }
})()
