import { api } from '@/api/api';
import { Role } from '@/api/roles';
import { PaginatedResponse } from '@/api/roles';

export interface User {
  id: number;
  login: string;
  avatar: string | null;
  status?: string;
  online?: boolean;
  presence?: string;
  email?: string;
  created_at?: string;
  last_activity?: string;
}

export interface HubMember {
  id: number;
  joined_at: string;
  user: User;
  roles?: Role[];
  online?: boolean;
  user_id?: number;
  hub_id?: number;
  is_owner?: boolean;
}

export interface UserProfile {
  user: User;
  hub_member: HubMember;
}

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentUser: builder.query<User, void>({
      query: () => ({
        url: '/api/v1/users/@me',
        method: 'GET',
      }),
      transformResponse: (response: any) => {
        return response;
      },
    }),
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
      transformResponse: (response: PaginatedResponse<User>) => {
        if (response && Array.isArray(response.content)) {
          return response.content;
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

export const { useGetCurrentUserQuery, useSearchUsersQuery, useGetUserProfileQuery } = usersApi;