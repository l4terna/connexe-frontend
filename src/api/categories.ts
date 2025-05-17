import { api } from '@/api/api';
import { Channel } from '@/api/channels';

export interface Category {
  id: number;
  name: string;
  position?: number;
  isDeleted?: boolean;
}

export interface CategoriesResponse {
  categories: Category[];
  channels: Channel[];
}

export const categoriesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createCategory: builder.mutation<Category, { hubId: number; name: string }>({
      query: ({ hubId, name }) => ({
        url: `/api/v1/hubs/${hubId}/categories`,
        method: 'POST',
        body: { name }
      }),
      invalidatesTags: ['Category']
    }),
    getCategories: builder.query<CategoriesResponse, number>({
      query: (hubId) => ({
        url: `/api/v1/hubs/${hubId}/entities`
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
    updateCategoryPosition: builder.mutation<Category, { hubId: number; categoryId: number; data: Partial<Category> }>({
      query: ({ hubId, categoryId, data }) => ({
        url: `/api/v1/hubs/${hubId}/categories/${categoryId}`,
        method: 'PUT',
        body: data
      }),
      invalidatesTags: ['Category']
    }),
    deleteCategory: builder.mutation<void, { hubId: number; categoryId: number }>({
      query: ({ hubId, categoryId }) => ({
        url: `/api/v1/hubs/${hubId}/categories/${categoryId}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Category']
    })
  })
});

export const {
  useCreateCategoryMutation,
  useGetCategoriesQuery,
  useUpdateCategoryPositionMutation,
  useDeleteCategoryMutation
} = categoriesApi;