import { api } from './api';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface AuthResponse {
  token: string;
  user: any;
}

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      queryFn: async (arg, api, extraOptions, baseQuery) => {
        try {
          const fp = await FingerprintJS.load();
          const { visitorId } = await fp.get();

          const result = await baseQuery({
            url: '/api/v1/auth/login',
            method: 'POST',
            body: {
              email: arg.email,
              password: arg.password,
              fingerprint: visitorId,
            },
          });

          if (result.data && 'token' in result.data) {
            localStorage.setItem('jwt', result.data.token as string);
            if ('user' in result.data) {
              localStorage.setItem('user', JSON.stringify(result.data.user));
            }
          }

          return result;
        } catch (error) {
          return { error };
        }
      },
    }),
    register: builder.mutation<AuthResponse, { login: string; email: string; password: string }>({
      queryFn: async (arg, api, extraOptions, baseQuery) => {
        try {
          const fp = await FingerprintJS.load();
          const { visitorId } = await fp.get();

          const result = await baseQuery({
            url: '/api/v1/auth/register',
            method: 'POST',
            body: {
              login: arg.login,
              email: arg.email,
              password: arg.password,
              fingerprint: visitorId,
            },
          });

          if (result.data && 'token' in result.data) {
            localStorage.setItem('jwt', result.data.token as string);
            if ('user' in result.data) {
              localStorage.setItem('user', JSON.stringify(result.data.user));
            }
          }

          return result;
        } catch (error) {
          return { error };
        }
      },
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApi; 