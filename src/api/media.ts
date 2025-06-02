import { api } from './api';
import { FetchBaseQueryError, FetchBaseQueryMeta, QueryReturnValue, BaseQueryApi } from '@reduxjs/toolkit/query';

interface SignedUrlResponse {
  sign: string;
  expires_at: string;
}

interface GetSignedUrlsResponse {
  [key: string]: SignedUrlResponse;
}

export const mediaApi = api.injectEndpoints({
  endpoints: (builder) => ({    
    getSignedUrls: builder.mutation<GetSignedUrlsResponse, { storage_keys: string[] }>({      
      query: (body) => {
        console.log('📡 mediaApi.getSignedUrls mutation called with:', body);
        return {
          url: '/api/v1/media-sign',
          method: 'POST',
          body
        };
      }
    }),
    getMediaUrl: builder.query<string, string>({
      queryFn: async (
        storageKey: string,
        apiArg: BaseQueryApi
      ): Promise<QueryReturnValue<string, FetchBaseQueryError, FetchBaseQueryMeta>> => {
        
        try {
          // Используем прямой fetch с токеном из store
          const token = (apiArg.getState() as any).auth.token;
          
          if (!token) {
            return { 
              error: { 
                status: 'CUSTOM_ERROR', 
                error: 'No auth token available' 
              } 
            };
          }

          const response = await fetch(`/api/v1/media/${storageKey}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!response.ok) {
            return { 
              error: { 
                status: 'CUSTOM_ERROR',
                error: `HTTP ${response.status}`,
                data: { statusCode: response.status }
              } 
            };
          }
          
          const blob = await response.blob();
          
          const objectUrl = URL.createObjectURL(blob);
          
          return { data: objectUrl };
        } catch (error) {
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
      providesTags: (_result, _error, storageKey) => [
        { type: 'Media', id: storageKey }
      ],
    }),
  }),
  // Обновляем тэги для кэширования
  overrideExisting: false,
});

export const { useGetMediaUrlQuery, useGetSignedUrlsMutation } = mediaApi;