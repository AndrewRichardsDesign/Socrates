const DB_NAME = 'velocityx-docs';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

export interface LocalDocument {
  id: string;
  title: string;
  content: string;
  fileType?: string;
  source?: string;
  createdAt: string;
  pdfData?: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
  
  return dbPromise;
}

export async function getAllDocuments(): Promise<LocalDocument[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const docs = request.result as LocalDocument[];
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(docs);
    };
  });
}

export async function getDocument(id: string): Promise<LocalDocument | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function createDocument(title: string, content: string, fileType?: string, source?: string, pdfData?: ArrayBuffer): Promise<LocalDocument> {
  const db = await getDB();
  const doc: LocalDocument = {
    id: crypto.randomUUID(),
    title,
    content,
    fileType: fileType || 'txt',
    source: source || 'upload',
    createdAt: new Date().toISOString(),
    ...(pdfData && { pdfData })
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(doc);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(doc);
  });
}

export async function updateDocument(id: string, title: string, content: string): Promise<LocalDocument | undefined> {
  const db = await getDB();
  const existing = await getDocument(id);
  if (!existing) return undefined;
  
  const updated: LocalDocument = {
    ...existing,
    title,
    content
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(updated);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updated);
  });
}

export async function deleteDocument(id: string): Promise<boolean> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(true);
  });
}
