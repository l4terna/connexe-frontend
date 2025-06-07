import { api } from '@/api/api';

export interface MediaSignRequest {
  storage_keys: string[];
}

export interface MediaSignature {
  sign: string;
  expires_at: string;
  user_id: number;
}

export interface MediaSignResponse {
  [storageKey: string]: MediaSignature; // storage_key -> signature object mapping
}

export const mediaApi = api.injectEndpoints({
  endpoints: (builder) => ({
    signMediaUrls: builder.mutation<MediaSignResponse, MediaSignRequest>({
      query: (data) => ({
        url: '/api/v1/media-sign',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Media']
    }),
  }),
});

export const { useSignMediaUrlsMutation } = mediaApi;