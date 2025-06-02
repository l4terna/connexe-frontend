import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useGetSignedUrlsMutation } from '../api/media';
import { useSignedUrlCache } from '../utils/signedUrlCache';

interface SignedUrlContextType {
  signedUrls: Map<string, string>;
  fetchSignedUrls: (storageKeys: string[]) => Promise<void>;
  getSignedUrl: (storageKey: string) => string | undefined;
}

const SignedUrlContext = createContext<SignedUrlContextType | undefined>(undefined);

export const SignedUrlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [signedUrls, setSignedUrls] = useState(new Map<string, string>());
  const [getSignedUrls, { isLoading: isMutationLoading, error: mutationError }] = useGetSignedUrlsMutation();
  const cache = useSignedUrlCache();
  
  console.log('🏗️ SignedUrlProvider: Initializing with signedUrls size:', signedUrls.size);
  console.log('🔍 Mutation state:', { isMutationLoading, mutationError });

  // Инициализация кэша
  useEffect(() => {
    cache.init();
  }, [cache]);

  const fetchSignedUrls = useCallback(async (storageKeys: string[]) => {
    console.log(`🚀 fetchSignedUrls called with ${storageKeys.length} keys:`, storageKeys);
    if (storageKeys.length === 0) {
      console.log(`❌ No storage keys provided, returning`);
      return;
    }

    try {
      console.log(`🔍 Запрос signed URLs для ${storageKeys.length} ключей:`, storageKeys);
      
      // 1. Проверяем кэш для всех ключей
      const cachedUrls = await cache.getMultiple(storageKeys);
      
      // 2. Добавляем закэшированные URL в память
      cachedUrls.forEach((url, key) => {
        signedUrls.set(key, url);
      });
      
      // 3. Определяем, какие ключи нужно запросить с сервера
      const keysToFetch = await cache.getKeysToFetch(storageKeys);
      
      console.log(`💾 Найдено в кэше: ${cachedUrls.size}, нужно запросить: ${keysToFetch.length}`);
      
      if (keysToFetch.length === 0) {
        console.log('✅ Все URL найдены в кэше');
        return;
      }

      // 4. Запрашиваем только недостающие URL
      console.log('🚀 Вызываем getSignedUrls mutation с параметрами:', { storage_keys: keysToFetch });
      
      const result = await getSignedUrls({
        storage_keys: keysToFetch
      }).unwrap();

      console.log('📡 Получен ответ от сервера:', result);

      // 5. Сохраняем новые URL в кэш и память
      const urlsToCache: Array<{ storageKey: string; signedUrl: string; expiresAt: string }> = [];
      
      Object.entries(result).forEach(([storageKey, data]) => {
        if (data && data.sign && data.expires_at) {
          signedUrls.set(storageKey, data.sign);
          urlsToCache.push({
            storageKey,
            signedUrl: data.sign,
            expiresAt: data.expires_at
          });
        }
      });

      // 6. Сохраняем в кэш
      if (urlsToCache.length > 0) {
        await cache.setMultiple(urlsToCache);
      }

    } catch (error) {
      console.error('❌ Ошибка получения signed URLs:', error);
    }
  }, [getSignedUrls, signedUrls, cache]);

  const getSignedUrl = useCallback((storageKey: string) => {
    return signedUrls.get(storageKey);
  }, [signedUrls]);

  return (
    <SignedUrlContext.Provider value={{ signedUrls, fetchSignedUrls, getSignedUrl }}>
      {children}
    </SignedUrlContext.Provider>
  );
};

export const useSignedUrls = () => {
  const context = useContext(SignedUrlContext);
  console.log('🔍 useSignedUrls called, context:', context ? 'exists' : 'null');
  if (!context) {
    throw new Error('useSignedUrls must be used within SignedUrlProvider');
  }
  console.log('🔍 useSignedUrls returning:', {
    signedUrlsSize: context.signedUrls.size,
    fetchSignedUrlsType: typeof context.fetchSignedUrls
  });
  return context;
};