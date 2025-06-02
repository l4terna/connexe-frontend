import useIndexedDB, { IndexedDBConfig, CacheOptions } from '../hooks/useIndexedDB';

// Конфигурация базы данных для signed URLs
export const signedUrlDBConfig: IndexedDBConfig = {
  dbName: 'SignedUrlCache',
  version: 1,
  stores: [
    {
      name: 'signedUrls',
      keyPath: 'key',
      indexes: [
        { name: 'expiresAt', keyPath: 'expiresAt' },
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'accessedAt', keyPath: 'accessedAt' }
      ]
    }
  ]
};

// Настройки кэша
export const signedUrlCacheOptions: CacheOptions = {
  maxSize: 1000,
  cleanupRatio: 0.2
};

const BUFFER_MINUTES = 10; // Буфер в 10 минут до истечения
const STORE_NAME = 'signedUrls';

// Конвертация UTC времени в локальное с буфером
function convertUtcToLocalWithBuffer(utcTimestamp: string): number {
  const utcDate = new Date(utcTimestamp);
  const bufferTime = BUFFER_MINUTES * 60 * 1000;
  return utcDate.getTime() - bufferTime; // Вычитаем буфер для более раннего истечения
}

// Хук для работы с кэшем signed URLs
export function useSignedUrlCache() {
  const db = useIndexedDB(signedUrlDBConfig);

  const get = async (storageKey: string): Promise<string | null> => {
    try {
      const url = await db.get<string>(STORE_NAME, storageKey);
      if (url) {
        console.log(`🗄️ Найден актуальный URL в кэше для ${storageKey}`);
      }
      return url;
    } catch (error) {
      console.error('Ошибка получения из кэша:', error);
      return null;
    }
  };

  const set = async (storageKey: string, signedUrl: string, expiresAtUtc: string): Promise<void> => {
    try {
      const expiresAt = convertUtcToLocalWithBuffer(expiresAtUtc);
      await db.set(STORE_NAME, storageKey, signedUrl, expiresAt, signedUrlCacheOptions);
      console.log(`💾 Сохранен URL в кэш для ${storageKey}, истекает ${new Date(expiresAt).toLocaleString()}`);
    } catch (error) {
      console.error('Ошибка сохранения в кэш:', error);
    }
  };

  const getMultiple = async (storageKeys: string[]): Promise<Map<string, string>> => {
    try {
      console.log('📖 getMultiple: reading from cache for keys:', storageKeys);
      const results = await db.getMultiple<string>(STORE_NAME, storageKeys);
      console.log('📖 getMultiple: found', results.size, 'URLs in cache');
      return results;
    } catch (error) {
      console.error('Ошибка получения множественных записей из кэша:', error);
      return new Map();
    }
  };

  const setMultiple = async (urlData: Array<{ storageKey: string; signedUrl: string; expiresAt: string }>): Promise<void> => {
    try {
      const items = urlData.map(({ storageKey, signedUrl, expiresAt }) => ({
        key: storageKey,
        data: signedUrl,
        expiresAt: convertUtcToLocalWithBuffer(expiresAt)
      }));
      
      await db.setMultiple(STORE_NAME, items, signedUrlCacheOptions);
    } catch (error) {
      console.error('Ошибка сохранения множественных записей в кэш:', error);
    }
  };

  const getKeysToFetch = async (storageKeys: string[]): Promise<string[]> => {
    console.log('🔍 getKeysToFetch called with keys:', storageKeys);
    const cachedUrls = await getMultiple(storageKeys);
    console.log('💾 Found in cache:', cachedUrls.size, 'URLs');
    const missingKeys = storageKeys.filter(key => !cachedUrls.has(key));
    console.log('❌ Missing keys:', missingKeys);
    return missingKeys;
  };

  const cleanExpired = async (): Promise<number> => {
    try {
      return await db.cleanExpired(STORE_NAME);
    } catch (error) {
      console.error('Ошибка очистки истекших записей:', error);
      return 0;
    }
  };

  const getStats = async (): Promise<{ total: number; expired: number }> => {
    try {
      return await db.getStats(STORE_NAME);
    } catch (error) {
      console.error('Ошибка получения статистики кэша:', error);
      return { total: 0, expired: 0 };
    }
  };

  const clear = async (): Promise<void> => {
    try {
      await db.clear(STORE_NAME);
      console.log('🗑️ Кэш signed URLs очищен');
    } catch (error) {
      console.error('Ошибка очистки кэша:', error);
    }
  };

  const init = async (): Promise<void> => {
    try {
      await db.init();
      const expiredCount = await cleanExpired();
      const stats = await getStats();
      console.log(`🗄️ Кэш signed URLs инициализирован. Записей: ${stats.total}, очищено истекших: ${expiredCount}`);
    } catch (error) {
      console.error('Ошибка инициализации кэша:', error);
    }
  };

  return {
    get,
    set,
    getMultiple,
    setMultiple,
    getKeysToFetch,
    cleanExpired,
    getStats,
    clear,
    init,
    isReady: db.isReady
  };
}