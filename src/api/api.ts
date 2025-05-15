import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { RootState } from '../store';

declare global {
  interface Window {
    notify?: (msg: string, sev?: string) => void;
    __notify?: (msg: string, sev?: string) => void;
  }
}

// Глобальный notify через window (чтобы можно было вызывать вне React-компонентов)
window.notify = (msg, sev = 'error') => {
  // @ts-ignore
  if (window.__notify) window.__notify(msg, sev);
};

export const getToken = () => localStorage.getItem('jwt');
export const setToken = (token: string) => localStorage.setItem('jwt', token);

const baseQuery = fetchBaseQuery({
  baseUrl: '/',
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
  credentials: 'include',
});

export const api = createApi({
  baseQuery: async (args, api, extraOptions) => {
    let result = await baseQuery(args, api, extraOptions);
    
    // Handle token refresh
    if (result.error && 'status' in result.error && result.error.status === 401) {
      try {
        const refreshResult = await baseQuery(
          { url: '/api/v1/auth/refresh', method: 'POST' },
          api,
          extraOptions
        );
        
        if (refreshResult.data && typeof refreshResult.data === 'object' && 'token' in refreshResult.data) {
          setToken(refreshResult.data.token as string);
          // Retry the original request
          result = await baseQuery(args, api, extraOptions);
        } else {
          // If refresh fails, clear token and redirect to login
          localStorage.removeItem('jwt');
          localStorage.removeItem('user');
          window.location.href = '/auth/login';
        }
      } catch (error) {
        // If refresh fails, clear token and redirect to login
        localStorage.removeItem('jwt');
        localStorage.removeItem('user');
        window.location.href = '/auth/login';
      }
    }
    
    return result;
  },
  endpoints: () => ({}),
  tagTypes: ['User', 'Hub', 'Channel', 'Role', 'Category', 'UserProfile', 'HubMember'],
});

export const { middleware } = api;

export const apiRequest = async (
  path: string,
  options: any = {},
  auth: boolean = true
) => {
  try {
    const headers: Record<string, string> = { ...options.headers };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Сохраняем user если есть
    if (data && data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  } catch (e: any) {
    window.notify && window.notify('Произошла ошибка запроса. Попробуйте позже!', 'error');
    throw e;
  }
}; 