import { api, baseQuery } from '@/api/api';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { BaseQueryFn, FetchBaseQueryError, FetchBaseQueryMeta, QueryReturnValue, BaseQueryApi } from '@reduxjs/toolkit/query';
import { store } from '@/store';
import { setUser, clearUser } from '@/store/userSlice';
import { setToken, clearToken } from '@/store/authSlice';

export interface User {
  id: number;
  login: string;
  avatar: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      queryFn: async (
        arg: { email: string; password: string },
        apiArg: BaseQueryApi,
        extraOptions: {},
        baseQuery: BaseQueryFn<any, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>
      ): Promise<QueryReturnValue<AuthResponse, FetchBaseQueryError, FetchBaseQueryMeta>> => {
        try {
          const fp = await FingerprintJS.load();
          const { visitorId } = await fp.get();

          const result = await baseQuery(
            {
              url: '/api/v1/auth/login',
              method: 'POST',
              body: {
                email: arg.email,
                password: arg.password,
                fingerprint: visitorId,
              },
            },
            apiArg,
            extraOptions
          );

          if (result.data) {
            const authData = result.data as AuthResponse;
            if ('token' in authData) {
              // Save token first
              store.dispatch(setToken(authData.token));
              
              if ('user' in authData) {
                // Save user to Redux store
                store.dispatch(setUser(authData.user));
                
                // Initialize WebSocket connection after successful login
                import('@/websocket/WebSocketService').then(({ webSocketService }) => {
                  webSocketService.ensureConnected()
                    .then(() => console.log('WebSocket connected after login'))
                    .catch(err => console.error('Failed to connect WebSocket:', err));
                });
              }
            }
            return { data: authData, meta: result.meta };
          }
          
          return { error: result.error as FetchBaseQueryError };
        } catch (error) {
          return { 
            error: { 
              status: 'CUSTOM_ERROR', 
              error: String(error) 
            } 
          };
        }
      },
    }),
    register: builder.mutation<AuthResponse, { login: string; email: string; password: string }>({
      queryFn: async (
        arg: { login: string; email: string; password: string },
        apiArg: BaseQueryApi,
        extraOptions: {},
        baseQuery: BaseQueryFn<any, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>
      ): Promise<QueryReturnValue<AuthResponse, FetchBaseQueryError, FetchBaseQueryMeta>> => {
        try {
          const fp = await FingerprintJS.load();
          const { visitorId } = await fp.get();

          const result = await baseQuery(
            {
              url: '/api/v1/auth/register',
              method: 'POST',
              body: {
                login: arg.login,
                email: arg.email,
                password: arg.password,
                fingerprint: visitorId,
              },
            },
            apiArg,
            extraOptions
          );

          if (result.data) {
            const authData = result.data as AuthResponse;
            if ('token' in authData) {
              // Save token first
              store.dispatch(setToken(authData.token));
              
              if ('user' in authData) {
                // Save user to Redux store
                store.dispatch(setUser(authData.user));
                
                // Initialize WebSocket connection after successful login
                import('@/websocket/WebSocketService').then(({ webSocketService }) => {
                  webSocketService.ensureConnected()
                    .then(() => console.log('WebSocket connected after login'))
                    .catch(err => console.error('Failed to connect WebSocket:', err));
                });
              }
            }
            return { data: authData, meta: result.meta };
          }
          
          return { error: result.error as FetchBaseQueryError };
        } catch (error) {
          return { 
            error: { 
              status: 'CUSTOM_ERROR', 
              error: String(error) 
            } 
          };
        }
      },
    }),
    logout: builder.mutation<void, void>({
      queryFn: async (
        arg: void,
        apiArg: BaseQueryApi,
        extraOptions: {},
        baseQuery: BaseQueryFn<any, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>
      ): Promise<QueryReturnValue<void, FetchBaseQueryError, FetchBaseQueryMeta>> => {
        try {
          // Call logout endpoint
          const result = await baseQuery(
            {
              url: '/api/v1/auth/logout',
              method: 'POST',
            },
            apiArg,
            extraOptions
          );

          if (!result.error) {
            // Disconnect WebSocket before clearing auth state
            import('@/websocket/WebSocketService').then(({ webSocketService }) => {
              webSocketService.disconnect();
            });
            
            // Only clear token and user from Redux store on successful logout
            store.dispatch(clearToken());
            store.dispatch(clearUser());
            return { data: undefined };
          }
          
          return { error: result.error };
        } catch (error) {
          return { 
            error: { 
              status: 'CUSTOM_ERROR', 
              error: String(error) 
            } 
          };
        }
      },
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation, useLogoutMutation } = authApi;