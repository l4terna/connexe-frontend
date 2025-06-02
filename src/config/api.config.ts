// Централизованная конфигурация API endpoints
export const API_CONFIG = {
  // Базовый URL API - в dev используем proxy, в prod - переменную окружения
  get baseUrl(): string {
    if (import.meta.env.DEV) {
      // В development используем Vite proxy (относительные URL)
      return '/api/v1';
    }
    // В production используем переменную окружения
    return import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
  },
  
  // Endpoints
  endpoints: {
    media: '/media',
    auth: '/auth',
    users: '/users',
    hubs: '/hubs',
    channels: '/channels',
  },
  
  // Конструктор URL для медиа файлов
  getMediaUrl: (storageKey: string): string => {
    const base = API_CONFIG.baseUrl.replace(/\/+$/, ''); // Убираем trailing slash
    return `${base}/media/${storageKey}`;
  },
  
  // Проверка, является ли URL запросом медиа
  isMediaUrl: (url: string): boolean => {
    const mediaPath = `${API_CONFIG.endpoints.media}/`;
    return url.includes(mediaPath) && url.includes('/api/v1/');
  },
  
  // Извлечение storageKey из URL
  extractStorageKey: (url: string): string | null => {
    const regex = /\/media\/([^\/\?]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
};

// Для отладки
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', {
    baseUrl: API_CONFIG.baseUrl,
    mediaEndpoint: API_CONFIG.endpoints.media,
    exampleMediaUrl: API_CONFIG.getMediaUrl('example-key'),
    environment: import.meta.env.MODE,
    viteApiUrl: import.meta.env.VITE_API_URL
  });
}