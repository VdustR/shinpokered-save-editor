/**
 * Local-only ROM persistence in IndexedDB so the Test Drive works offline
 * after the user picks their ROM once. The ROM never leaves the browser.
 */

const DB_NAME = "spse-emulator";
const STORE = "roms";
const KEY = "rom";

export interface StoredRom {
  name: string;
  bytes: Uint8Array;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRom(name: string, bytes: Uint8Array): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await requestToPromise(tx.objectStore(STORE).put({ name, bytes }, KEY));
  } finally {
    db.close();
  }
}

export async function loadRom(): Promise<StoredRom | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const value = await requestToPromise(tx.objectStore(STORE).get(KEY));
    if (!value) return null;
    const { name, bytes } = value as { name: string; bytes: Uint8Array };
    return { name, bytes: new Uint8Array(bytes) };
  } finally {
    db.close();
  }
}

export async function clearRom(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await requestToPromise(tx.objectStore(STORE).delete(KEY));
  } finally {
    db.close();
  }
}
