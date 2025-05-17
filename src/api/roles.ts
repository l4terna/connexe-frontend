import { api } from '@/api/api';

export interface Role {
  id: number;
  name: string;
  color: string;
  permissions: string;
}

export interface CreateRoleDTO {
  name: string;
  color: string;
  permissions: string;
}

export interface UpdateRoleDTO {
  name?: string;
  color?: string;
  permissions?: string;
}

// Generic paginated response interface that can be reused across the API
export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  last: boolean;
}

export const rolesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<PaginatedResponse<Role>, { 
      hubId: number; 
      page?: number; 
      size?: number; 
      excludedMemberRolesById?: number; 
      s?: string 
    }>({
      query: ({ hubId, page = 0, size = 30, excludedMemberRolesById, s }) => ({
        url: `/api/v1/hubs/${hubId}/roles`,
        method: 'GET',
        params: { page, size, excludedMemberRolesById, s, sort: 'createdAt,desc' }
      }),
      providesTags: (_result, _error, { hubId, excludedMemberRolesById }) => [
        { type: 'Role', id: `${hubId}-${excludedMemberRolesById}` },
      ],
    }),
    createRole: builder.mutation<Role, { hubId: number; data: CreateRoleDTO }>({
      query: ({ hubId, data }) => ({
        url: `/api/v1/hubs/${hubId}/roles`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { hubId }) => [
        { type: 'Role', id: `${hubId}-*` }
      ],
    }),
    updateRole: builder.mutation<Role, { hubId: number; roleId: number; data: UpdateRoleDTO }>({
      query: ({ hubId, roleId, data }) => ({
        url: `/api/v1/hubs/${hubId}/roles/${roleId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { hubId }) => [
        { type: 'Role', id: `${hubId}-*` }
      ],
    }),
    deleteRole: builder.mutation<void, { hubId: number; roleId: number }>({
      query: ({ hubId, roleId }) => ({
        url: `/api/v1/hubs/${hubId}/roles/${roleId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { hubId }) => [
        { type: 'Role', id: `${hubId}-*` }
      ],
    }),
    assignRole: builder.mutation<void, { hubId: number; memberId: number; roleId: number }>({
      query: ({ hubId, memberId, roleId }) => ({
        url: `/api/v1/hubs/${hubId}/members/${memberId}/roles`,
        method: 'POST',
        body: { role_id: roleId }
      }),
      invalidatesTags: (_result, _error, { hubId, memberId }) => [
        { type: 'Role', id: `${hubId}-${memberId}` },
        { type: 'Role', id: `${hubId}-*` },
        'User',
        'UserProfile'
      ],
    }),
    removeRole: builder.mutation<void, { hubId: number; memberId: number; roleId: number }>({
      query: ({ hubId, memberId, roleId }) => ({
        url: `/api/v1/hubs/${hubId}/members/${memberId}/roles/${roleId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { hubId, memberId }) => [
        { type: 'Role', id: `${hubId}-${memberId}` },
        { type: 'Role', id: `${hubId}-*` },
        'User',
        'UserProfile'
      ],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useAssignRoleMutation,
  useRemoveRoleMutation,
} = rolesApi;