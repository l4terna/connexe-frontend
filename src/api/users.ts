import { api } from './api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface User {
  id: number;
  login: string;
  avatar: string | null;
  status?: string;
}

export interface Role {
  id: number;
  name: string;
  color: string;
  permissions: string;
}

export interface HubMember {
  id: number;
  joined_at: string;
  user: User;
  roles?: Role[];
}

export interface UserProfile {
  user: User;
  hub_member: HubMember;
}

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    searchUsers: builder.query<User[], string>({
      query: (login) => ({
        url: '/api/v1/users',
        params: {
          login,
          page: 0,
          size: 50,
          sort: 'createdAt,desc'
        }
      }),
      transformResponse: (response: any) => {
        if (response && Array.isArray(response.content)) {
          return response.content as User[];
        }
        return [];
      },
    }),
    getUserProfile: builder.query<UserProfile, { userId: number; hubId: number }>({
      query: ({ userId, hubId }) => ({
        url: `/api/v1/users/${userId}/profile`,
        method: 'GET',
        params: {
          hubId
        }
      }),
      providesTags: ['UserProfile'],
    }),
  }),
});

export const { useSearchUsersQuery, useGetUserProfileQuery } = usersApi; 