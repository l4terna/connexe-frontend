import { api } from './api';

const API_URL = '/api/v1/hubs';

export interface Hub {
  id: number;
  name: string;
  type: string;
  is_private: boolean;
  avatar?: string;
  member_count?: number;
}

export interface Role {
  id: number;
  name: string;
  color: string;
  permissions: string;
}

export interface HubMember {
  id: number;
  hub_id: number;
  user_id: number;
  roles: Role[];
  is_owner: boolean;
  joinedAt: string;
  // Add other relevant fields
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
      transformResponse: (response: any) => response.content as Hub[],
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