import { api } from '@/api/api';
import { Role } from '@/api/roles';
import { HubMember } from '@/api/users';

const API_URL = '/api/v1/hubs';

export interface Hub {
  id: number;
  name: string;
  type: string;
  is_private: boolean; // Note: API uses snake_case (is_private) but we keep it as is for consistency
  avatar?: string;
  member_count?: number; // Note: API uses snake_case (member_count) but we keep it as is for consistency
}

// This HubMember interface is specific to hub context and different from the one in users.ts
export interface HubMemberResponse {
  id: number;
  hub_id: number;
  user_id: number;
  roles: Role[];
  is_owner: boolean;
  joined_at: string;
  user?: {
    id: number;
    login: string;
    avatar: string | null;
    online?: boolean;
    presence?: string;
  };
}

export interface CreateInviteDTO {
  max_uses?: number;
  expires_at?: string;
}

export interface InviteDTO {
  id: number;
  code: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

export interface PageInviteDTO {
  totalElements: number;
  totalPages: number;
  size: number;
  content: InviteDTO[];
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  first: boolean;
  last: boolean;
  numberOfElements: number;
  pageable: {
    offset: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    pageNumber: number;
    pageSize: number;
    paged: boolean;
    unpaged: boolean;
  };
  empty: boolean;
}

export interface GetHubsParams {
  name?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface UpdateHubDTO {
  name: string;
}

export type UpdateHubData = UpdateHubDTO | FormData;

export interface HubsResponse {
  content: Hub[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  last: boolean;
}

export const hubsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createHub: builder.mutation<Hub, FormData>({
      query: (data) => ({
        url: API_URL,
        method: 'POST',
        body: data,
        formData: true
      }),
      invalidatesTags: ['Hub']
    }),
    updateHub: builder.mutation<Hub, { hubId: number; data: UpdateHubData }>({
      query: ({ hubId, data }) => ({
        url: `${API_URL}/${hubId}`,
        method: 'PUT',
        body: data,
        formData: data instanceof FormData
      }),
      invalidatesTags: ['Hub']
    }),
    getHubs: builder.query<Hub[], GetHubsParams>({
      query: (params) => ({
        url: params.name ? API_URL : `${API_URL}/@me`,
        params: {
          page: params.page || 0,
          size: params.size || 50,
          sort: params.sort || 'createdAt,desc',
          name: params.name
        }
      }),
      transformResponse: (response: HubsResponse) => response.content,
      providesTags: ['Hub'],
      keepUnusedDataFor: 0,
      serializeQueryArgs: ({ queryArgs }) => {
        return queryArgs;
      },
      merge: (currentCache, newItems) => {
        return newItems;
      },
      forceRefetch({ currentArg, previousArg }) {
        return currentArg !== previousArg;
      }
    }),
    getHubMembers: builder.query<HubMember[], { hubId: number; after?: number }>({
      query: ({ hubId, after }) => ({
        url: `${API_URL}/${hubId}/members`,
        params: after ? { after } : undefined
      }),
      transformResponse: (response: HubMemberResponse[]) => {
        // Transform API response to match HubMember interface from users.ts
        return response.map(member => ({
          id: member.id,
          hub_id: member.hub_id,
          user_id: member.user_id,
          joined_at: member.joined_at,
          is_owner: member.is_owner,
          roles: member.roles,
          user: member.user || {
            id: member.user_id,
            login: `User ${member.user_id}`,
            avatar: null
          }
        } as HubMember & { hub_id: number; user_id: number; is_owner: boolean }));
      },
      keepUnusedDataFor: 0,
      serializeQueryArgs: ({ queryArgs }) => {
        return queryArgs;
      },
      merge: (currentCache, newItems) => {
        return newItems;
      },
      forceRefetch({ currentArg, previousArg }) {
        return currentArg !== previousArg;
      }
    }),
    createInvite: builder.mutation<InviteDTO, { hubId: number; data: CreateInviteDTO }>({
      query: ({ hubId, data }) => ({
        url: `${API_URL}/${hubId}/invites`,
        method: 'POST',
        body: data
      })
    }),
    getInvites: builder.query<PageInviteDTO, { hubId: number; page?: number; size?: number }>({
      query: ({ hubId, page = 0, size = 50 }) => ({
        url: `${API_URL}/${hubId}/invites`,
        params: {
          page,
          size,
          sort: 'createdAt,desc'
        }
      }),
    }),
    deleteInvite: builder.mutation<void, { hubId: number; inviteId: number }>({
      query: ({ hubId, inviteId }) => ({
        url: `${API_URL}/${hubId}/invites/${inviteId}`,
        method: 'DELETE'
      })
    }),
    joinHub: builder.mutation<void, number>({
      query: (hubId) => ({
        url: `${API_URL}/${hubId}/members`,
        method: 'POST'
      }),
      invalidatesTags: ['Hub']
    }),
    deleteHub: builder.mutation<void, number>({
      query: (hubId) => ({
        url: `${API_URL}/${hubId}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Hub']
    }),
    getHubMembership: builder.query<HubMember, number>({
      query: (hubId) => ({
        url: `${API_URL}/${hubId}/members/@me`,
        method: 'GET',
      }),
      providesTags: (result, error, hubId) => [{ type: 'HubMember', id: hubId }],
    }),
  })
});

export const {
  useCreateHubMutation,
  useUpdateHubMutation,
  useGetHubsQuery,
  useLazyGetHubsQuery,
  useGetHubMembersQuery,
  useCreateInviteMutation,
  useGetInvitesQuery,
  useDeleteInviteMutation,
  useJoinHubMutation,
  useDeleteHubMutation,
  useGetHubMembershipQuery
} = hubsApi;