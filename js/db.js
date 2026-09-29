// IndexedDB 极简封装：cache 存 sprite 文本/解析结果，meta 存检测结果与修正记录。
const DB_NAME = 'svg-icon-compat';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(result._value);
    tx.onerror = () => reject(tx.error);
    if (result && 'onsuccess' in result) {
      result.onsuccess = () => { result._value = result.result; };
    }
  });
}

export async function dbGet(store, key) {
  try { return await withStore(store, 'readonly', (s) => s.get(key)); }
  catch { return undefined; }
}

export async function dbSet(store, key, value) {
  try { await withStore(store, 'readwrite', (s) => s.put(value, key)); }
  catch { /* 隐私模式等场景下 IndexedDB 不可用，静默降级为不缓存 */ }
}
