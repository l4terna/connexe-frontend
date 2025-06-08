import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { store } from '@/store';
import { clearUser } from '@/store/userSlice';
import { clearToken, setToken as setAuthToken } from '@/store/authSlice';
import { navigateTo } from '@/store/navigationMiddleware';

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

export const getToken = (): string | null => store.getState().auth.token;
export const setToken = (token: string): void => {
  store.dispatch(setAuthToken(token));
};

// Base URL for API requests - ensure it's consistent across the app
const API_BASE_URL = '/';

export const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState, endpoint }) => {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    // Don't set Content-Type for FormData - let the browser set it with boundary
    if (headers.get('Content-Type')?.includes('multipart/form-data')) {
      headers.delete('Content-Type');
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
          store.dispatch(clearToken());
          store.dispatch(clearUser());
          store.dispatch(navigateTo('/auth/login'));
        }
      } catch (error) {
        // If refresh fails, clear token and redirect to login
        store.dispatch(clearToken());
        store.dispatch(clearUser());
        store.dispatch(navigateTo('/auth/login'));
      }
    }
    
    return result;
  },
  endpoints: () => ({}),
  tagTypes: ['User', 'Hub', 'Channel', 'Role', 'Category', 'UserProfile', 'HubMember', 'Media', 'SearchResults'],
});

// Create a helper API for one-off requests that don't need endpoints
export const oneOffApi = createApi({
  reducerPath: 'oneOffApi',
  baseQuery: baseQuery,
  endpoints: (builder) => ({
    query: builder.query({
      query: (arg) => arg,
    }),
  }),
});

// Export middleware
export const { middleware } = api;

// Export utility endpoints for direct usage
export const { useQueryQuery } = oneOffApi;

// Helper function that uses RTK Query instead of fetch
export const apiRequest = async <T = any>(
  path: string,
  options: Omit<RequestInit, 'body'> & { body?: any } = {}
): Promise<T> => {
  try {
    // Create a properly formatted path
    const url = path.startsWith('http') 
      ? path 
      : path.startsWith('/') 
        ? path.substring(1) 
        : path;
    
    const method = options.method || 'GET';
    
    // Create a proper RTK Query request object
    const request = {
      url,
      method,
      body: options.body,
      headers: options.headers,
    };
    
    // Use the main API's baseQuery directly
    const result = await baseQuery(request, {
      signal: new AbortController().signal,
      dispatch: () => {},
      getState: () => ({}),
      abort: () => {},
      extra: undefined,
      endpoint: '',
      type: 'query',
    }, {});
    
    if (result.error) {
      throw new Error(`API error: ${JSON.stringify(result.error)}`);
    }
    
    // Store user data if present
    if (result.data && typeof result.data === 'object' && 'user' in result.data) {
      store.dispatch({ type: 'user/setUser', payload: result.data.user });
    }
    
    return result.data as T;
  } catch (e: Error | unknown) {
    window.notify && window.notify('Произошла ошибка запроса. Попробуйте позже!', 'error');
    throw e;
  }
};