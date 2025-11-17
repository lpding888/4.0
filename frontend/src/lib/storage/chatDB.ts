/**
 * IndexedDB 聊天存储
 * 艹，原生IndexedDB就够了，别搞太多依赖！
 *
 * @author 老王
 */

const DB_NAME = 'ai-wardrobe';
const STORE = 'chat';

function withDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveChat(session: {
  id: string;
  title: string;
  messages: any[]
}) {
  const db = await withDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const request = tx.objectStore(STORE).put(session);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getChat(id: string) {
  const db = await withDB();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllChats() {
  const db = await withDB();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteChat(id: string) {
  const db = await withDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const request = tx.objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
