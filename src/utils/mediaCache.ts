interface CachedMediaUrl {
  url: string;
  expiresAt: Date;
  storageKey: string;
  lastAccessed: Date;
}

interface MediaCacheStorage {
  [storageKey: string]: CachedMediaUrl;
}

class MediaCache {
  private cache: MediaCacheStorage = {};
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'MediaCache';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'media_urls';
  private readonly MAX_ENTRIES = 2000; // Максимум записей в кэше
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB();
    this.startCleanupTimer();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not available, falling back to memory cache');
        resolve();
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => {
        console.warn('Failed to open IndexedDB, falling back to memory cache:', request.error);
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.loadFromDB().then(() => resolve());
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'storageKey' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };
    });
  }

  private async loadFromDB(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const now = new Date();
        request.result.forEach((item: any) => {
          const expiresAt = new Date(item.expiresAt);
          const lastAccessed = new Date(item.lastAccessed);
          
          if (expiresAt > now) {
            this.cache[item.storageKey] = {
              url: item.url,
              expiresAt,
              storageKey: item.storageKey,
              lastAccessed
            };
          }
        });
      };
    } catch (error) {
      console.warn('Failed to load from IndexedDB:', error);
    }
  }

  private async saveToDB(entry: CachedMediaUrl): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const dbEntry = {
        storageKey: entry.storageKey,
        url: entry.url,
        expiresAt: entry.expiresAt.toISOString(),
        lastAccessed: entry.lastAccessed.toISOString()
      };
      
      store.put(dbEntry);
    } catch (error) {
      console.warn('Failed to save to IndexedDB:', error);
    }
  }

  private async deleteFromDB(storageKey: string): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      store.delete(storageKey);
    } catch (error) {
      console.warn('Failed to delete from IndexedDB:', error);
    }
  }

  private async enforceMaxEntries(): Promise<void> {
    const entries = Object.entries(this.cache);
    
    if (entries.length <= this.MAX_ENTRIES) return;

    // Сортируем по lastAccessed (LRU - Least Recently Used)
    const sortedEntries = entries.sort((a, b) => 
      a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime()
    );

    // Удаляем 20% от максимума (400 записей)
    const toRemove = Math.floor(this.MAX_ENTRIES * 0.2);
    const entriesToRemove = sortedEntries.slice(0, toRemove);

    for (const [storageKey] of entriesToRemove) {
      delete this.cache[storageKey];
      await this.deleteFromDB(storageKey);
    }

    console.log(`MediaCache: Removed ${toRemove} old entries, ${Object.keys(this.cache).length} remaining`);
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private async cleanup(): Promise<void> {
    const now = new Date();
    const expiredKeys: string[] = [];

    Object.keys(this.cache).forEach(key => {
      if (this.cache[key].expiresAt <= now) {
        expiredKeys.push(key);
        delete this.cache[key];
      }
    });

    // Удаляем из IndexedDB
    for (const key of expiredKeys) {
      await this.deleteFromDB(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`MediaCache: Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  async get(storageKey: string): Promise<string | null> {
    if (this.initPromise) {
      await this.initPromise;
    }

    const cached = this.cache[storageKey];
    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt <= new Date()) {
      delete this.cache[storageKey];
      await this.deleteFromDB(storageKey);
      return null;
    }

    // Update last accessed time
    cached.lastAccessed = new Date();
    await this.saveToDB(cached);

    return cached.url;
  }

  // Синхронная версия для обратной совместимости
  getSync(storageKey: string): string | null {
    const cached = this.cache[storageKey];
    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt <= new Date()) {
      delete this.cache[storageKey];
      this.deleteFromDB(storageKey); // Fire and forget
      return null;
    }

    // Update last accessed time (fire and forget)
    cached.lastAccessed = new Date();
    this.saveToDB(cached);

    return cached.url;
  }

  async set(storageKey: string, url: string, expiresAt: string): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }

    const expirationDate = new Date(expiresAt);
    const entry: CachedMediaUrl = {
      url,
      expiresAt: expirationDate,
      storageKey,
      lastAccessed: new Date()
    };
    
    this.cache[storageKey] = entry;
    
    // Проверяем лимит записей
    await this.enforceMaxEntries();
    
    // Сохраняем в IndexedDB
    await this.saveToDB(entry);
  }

  async setMultiple(entries: Array<{ storageKey: string; url: string; expiresAt: string }>): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }

    const now = new Date();
    const cacheEntries: CachedMediaUrl[] = [];

    entries.forEach(({ storageKey, url, expiresAt }) => {
      const expirationDate = new Date(expiresAt);
      const entry: CachedMediaUrl = {
        url,
        expiresAt: expirationDate,
        storageKey,
        lastAccessed: now
      };
      
      this.cache[storageKey] = entry;
      cacheEntries.push(entry);
    });

    // Проверяем лимит записей
    await this.enforceMaxEntries();

    // Bulk insert в IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        
        cacheEntries.forEach(entry => {
          const dbEntry = {
            storageKey: entry.storageKey,
            url: entry.url,
            expiresAt: entry.expiresAt.toISOString(),
            lastAccessed: entry.lastAccessed.toISOString()
          };
          store.put(dbEntry);
        });
      } catch (error) {
        console.warn('Failed to bulk insert to IndexedDB:', error);
      }
    }
  }

  has(storageKey: string): boolean {
    const cached = this.cache[storageKey];
    if (!cached) {
      return false;
    }

    // Check if expired
    if (cached.expiresAt <= new Date()) {
      delete this.cache[storageKey];
      this.deleteFromDB(storageKey); // Fire and forget
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache = {};
    
    if (this.db) {
      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        store.clear();
      } catch (error) {
        console.warn('Failed to clear IndexedDB:', error);
      }
    }
  }

  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    await this.clear();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Get all cached storage keys (for debugging)
  getCachedKeys(): string[] {
    this.cleanup(); // Clean up first (fire and forget)
    return Object.keys(this.cache);
  }

  // Get cache stats (for debugging)
  getStats(): { total: number; expired: number; maxEntries: number } {
    const now = new Date();
    const total = Object.keys(this.cache).length;
    const expired = Object.values(this.cache).filter(item => item.expiresAt <= now).length;
    
    return { total, expired, maxEntries: this.MAX_ENTRIES };
  }
}

// Export singleton instance
export const mediaCache = new MediaCache();

// Export class for testing
export { MediaCache };