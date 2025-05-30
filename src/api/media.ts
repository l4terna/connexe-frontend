import { api, baseQuery } from './api';
import { BaseQueryFn, FetchBaseQueryError, FetchBaseQueryMeta, QueryReturnValue, BaseQueryApi } from '@reduxjs/toolkit/query';

export const mediaApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMediaUrl: builder.query<string, string>({
      queryFn: async (
        storageKey: string,
        apiArg: BaseQueryApi,
        extraOptions: {},
        baseQuery: BaseQueryFn<any, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>
      ): Promise<QueryReturnValue<string, FetchBaseQueryError, FetchBaseQueryMeta>> => {
        console.log('🔄 Starting media query for:', storageKey);
        
        try {
          // Используем прямой fetch с токеном из store
          const token = (apiArg.getState() as any).auth.token;
          
          if (!token) {
            return { 
              error: { 
                status: 'UNAUTHORIZED', 
                error: 'No auth token available' 
              } 
            };
          }

          const response = await fetch(`/api/v1/media/${storageKey}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log('📡 Direct fetch response:', { 
            storageKey, 
            status: response.status, 
            ok: response.ok,
            contentType: response.headers.get('content-type')
          });
          
          if (!response.ok) {
            return { 
              error: { 
                status: response.status, 
                error: `HTTP ${response.status}` 
              } 
            };
          }
          
          const blob = await response.blob();
          console.log('📦 Blob received:', { storageKey, blobSize: blob.size, blobType: blob.type });
          
          const objectUrl = URL.createObjectURL(blob);
          console.log('✅ Object URL created:', { storageKey, objectUrl });
          
          return { data: objectUrl };
        } catch (error) {
          console.error('💥 Media query exception:', { storageKey, error });
          return { 
            error: { 
              status: 'FETCH_ERROR', 
              error: String(error) 
            } 
          };
        }
      },
      // Кэширование на 5 минут - изображения не часто меняются
      keepUnusedDataFor: 300, // 5 минут
      // Провайдер тэгов для инвалидации кэша
      providesTags: (result, error, storageKey) => [
        { type: 'Media', id: storageKey }
      ],
    }),
  }),
  // Обновляем тэги для кэширования
  overrideExisting: false,
});

export const { useGetMediaUrlQuery } = mediaApi;