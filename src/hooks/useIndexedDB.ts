import { useCallback, useRef, useEffect } from 'react';

export interface IndexedDBConfig {
  dbName: string;
  version: number;
  stores: {
    name: string;
    keyPath: string;
    indexes?: { name: string; keyPath: string | string[]; unique?: boolean }[];
  }[];
}

export interface CacheOptions {
  maxSize?: number;
  cleanupRatio?: number; // Процент записей для удаления при переполнении (0.0 - 1.0)
}

export interface CacheItem<T = any> {
  key: string;
  data: T;
  expiresAt?: number;
  createdAt: number;
  accessedAt: number;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private config: IndexedDBConfig;
  private isInitialized = false;

  constructor(config: IndexedDBConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        this.config.stores.forEach(storeConfig => {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, { keyPath: storeConfig.keyPath });
            
            storeConfig.indexes?.forEach(index => {
              store.createIndex(index.name, index.keyPath, { unique: index.unique || false });
            });
          }
        });
      };
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as CacheItem<T> | undefined;
        
        if (!result) {
          resolve(null);
          return;
        }
        
        // Проверяем срок действия
        if (result.expiresAt && Date.now() >= result.expiresAt) {
          this.delete(storeName, key); // Удаляем истекшую запись
          resolve(null);
          return;
        }
        
        // Обновляем время последнего доступа
        this.updateAccessTime(storeName, key);
        
        resolve(result.data);
      };
    });
  }

  async set<T>(
    storeName: string, 
    key: string, 
    data: T, 
    expiresAt?: number,
    options?: CacheOptions
  ): Promise<void> {
    await this.ensureInitialized();
    
    const item: CacheItem<T> = {
      key,
      data,
      expiresAt,
      createdAt: Date.now(),
      accessedAt: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Проверяем размер кэша при необходимости
      if (options?.maxSize) {
        const countRequest = store.count();
        countRequest.onsuccess = async () => {
          const count = countRequest.result;
          
          if (count >= options.maxSize!) {
            const cleanupCount = Math.floor(options.maxSize! * (options.cleanupRatio || 0.2));
            console.log(`🧹 Кэш ${storeName} переполнен (${count}/${options.maxSize}), очищаем ${cleanupCount} записей`);
            await this.cleanupOldest(storeName, cleanupCount);
          }
          
          const putRequest = store.put(item);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        };
        countRequest.onerror = () => reject(countRequest.error);
      } else {
        const putRequest = store.put(item);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      }
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getMultiple<T>(storeName: string, keys: string[]): Promise<Map<string, T>> {
    await this.ensureInitialized();
    
    const result = new Map<string, T>();
    const promises = keys.map(async (key) => {
      const data = await this.get<T>(storeName, key);
      if (data !== null) {
        result.set(key, data);
      }
    });
    
    await Promise.all(promises);
    return result;
  }

  async setMultiple<T>(
    storeName: string, 
    items: Array<{ key: string; data: T; expiresAt?: number }>,
    options?: CacheOptions
  ): Promise<void> {
    await this.ensureInitialized();
    
    const promises = items.map(({ key, data, expiresAt }) => 
      this.set(storeName, key, data, expiresAt, options)
    );
    
    await Promise.all(promises);
  }

  async cleanExpired(storeName: string): Promise<number> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const now = Date.now();
      let cleanedCount = 0;
      
      const request = store.openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const item = cursor.value as CacheItem;
          if (item.expiresAt && now >= item.expiresAt) {
            cursor.delete();
            cleanedCount++;
          }
          cursor.continue();
        } else {
          resolve(cleanedCount);
        }
      };
    });
  }

  private async cleanupOldest(storeName: string, countToRemove: number): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Собираем все записи для сортировки по времени доступа
      const items: Array<{ key: string; accessedAt: number }> = [];
      const getAllRequest = store.openCursor();
      
      getAllRequest.onerror = () => reject(getAllRequest.error);
      getAllRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const item = cursor.value as CacheItem;
          items.push({ key: item.key, accessedAt: item.accessedAt });
          cursor.continue();
        } else {
          // Сортируем по времени доступа (LRU) и удаляем самые старые
          items.sort((a, b) => a.accessedAt - b.accessedAt);
          const toDelete = items.slice(0, countToRemove);
          
          const deletePromises = toDelete.map(item => this.delete(storeName, item.key));
          Promise.all(deletePromises)
            .then(() => {
              console.log(`🗑️ Удалено ${toDelete.length} старых записей из ${storeName}`);
              resolve();
            })
            .catch(reject);
        }
      };
    });
  }

  private async updateAccessTime(storeName: string, key: string): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const getRequest = store.get(key);
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const item = getRequest.result as CacheItem;
        if (item) {
          item.accessedAt = Date.now();
          const putRequest = store.put(item);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        } else {
          resolve();
        }
      };
    });
  }

  async getStats(storeName: string): Promise<{ total: number; expired: number }> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const totalRequest = store.count();
      totalRequest.onerror = () => reject(totalRequest.error);
      totalRequest.onsuccess = () => {
        const total = totalRequest.result;
        const now = Date.now();
        let expired = 0;
        
        const cursorRequest = store.openCursor();
        cursorRequest.onerror = () => reject(cursorRequest.error);
        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const item = cursor.value as CacheItem;
            if (item.expiresAt && now >= item.expiresAt) {
              expired++;
            }
            cursor.continue();
          } else {
            resolve({ total, expired });
          }
        };
      };
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export function useIndexedDB(config: IndexedDBConfig) {
  const managerRef = useRef<IndexedDBManager | null>(null);

  // Инициализация менеджера
  if (!managerRef.current) {
    managerRef.current = new IndexedDBManager(config);
  }

  const manager = managerRef.current;

  // Методы для работы с кэшем
  const get = useCallback(<T>(storeName: string, key: string) => {
    return manager.get<T>(storeName, key);
  }, [manager]);

  const set = useCallback(<T>(
    storeName: string, 
    key: string, 
    data: T, 
    expiresAt?: number,
    options?: CacheOptions
  ) => {
    return manager.set(storeName, key, data, expiresAt, options);
  }, [manager]);

  const remove = useCallback((storeName: string, key: string) => {
    return manager.delete(storeName, key);
  }, [manager]);

  const getMultiple = useCallback(<T>(storeName: string, keys: string[]) => {
    return manager.getMultiple<T>(storeName, keys);
  }, [manager]);

  const setMultiple = useCallback(<T>(
    storeName: string, 
    items: Array<{ key: string; data: T; expiresAt?: number }>,
    options?: CacheOptions
  ) => {
    return manager.setMultiple(storeName, items, options);
  }, [manager]);

  const cleanExpired = useCallback((storeName: string) => {
    return manager.cleanExpired(storeName);
  }, [manager]);

  const getStats = useCallback((storeName: string) => {
    return manager.getStats(storeName);
  }, [manager]);

  const clear = useCallback((storeName: string) => {
    return manager.clear(storeName);
  }, [manager]);

  const init = useCallback(() => {
    return manager.init();
  }, [manager]);

  // Автоматическая инициализация при монтировании
  useEffect(() => {
    manager.init().catch(error => {
      console.error('IndexedDB initialization failed:', error);
    });
  }, [manager]);

  return {
    get,
    set,
    remove,
    getMultiple,
    setMultiple,
    cleanExpired,
    getStats,
    clear,
    init,
    isReady: () => manager.db !== null
  };
}

export default useIndexedDB;