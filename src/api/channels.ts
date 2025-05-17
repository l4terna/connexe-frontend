import { api } from '@/api/api';
import { User } from '@/api/users';

export enum ChannelType {
  VOICE = 0,
  TEXT = 1
}

export interface Channel {
  id: number;
  name: string;
  type: ChannelType;
  categoryId: number;
  position?: number;
  isDeleted?: boolean;
}

export interface CreateChannelDto {
  name: string;
  type: ChannelType;
  categoryId: number;
}

export interface Message {
  id: number;
  content: string;
  author: User;
  created_at: string; // ISO 8601 date string
  attachments: string[]; // URLs to attachment files
  last_modified_at?: string; // ISO 8601 date string if message was edited
  read_by_count?: number; // Number of users who have read this message
}

export interface GetMessagesParams {
  before?: number;
  after?: number;
  around?: number;
  size?: number;
}

export interface CategoryWithChannels {
  id: string | number;
  name: string;
  channels: Channel[];
}

export const channelsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createChannel: builder.mutation<Channel, { hubId: number; categoryId: number; data: CreateChannelDto }>({
      query: ({ hubId, data }) => ({
        url: `/api/v1/hubs/${hubId}/channels`,
        method: 'POST',
        body: {
          ...data,
          category_id: data.categoryId // Convert camelCase to snake_case for API
        }
      }),
      invalidatesTags: ['Channel']
    }),
    updateChannel: builder.mutation<Channel, { channelId: number; data: Partial<Channel> & { categoryId?: number } }>({
      query: ({ channelId, data }) => {
        // Convert categoryId to category_id for API if present
        const apiData = { ...data };
        if ('categoryId' in apiData) {
          apiData.category_id = apiData.categoryId;
          delete apiData.categoryId;
        }
        
        return {
          url: `/api/v1/channels/${channelId}`,
          method: 'PUT',
          body: apiData
        };
      },
      invalidatesTags: ['Channel']
    }),
    deleteChannel: builder.mutation<void, { channelId: number }>({
      query: ({ channelId }) => ({
        url: `/api/v1/channels/${channelId}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Channel']
    }),
    getMessages: builder.query<Message[], { channelId: number; params?: GetMessagesParams }>({
      query: ({ channelId, params }) => ({
        url: `/api/v1/channels/${channelId}/messages`,
        params
      }),
      keepUnusedDataFor: 0,
      serializeQueryArgs: ({ queryArgs }) => {
        return queryArgs.channelId;
      },
      merge: (currentCache, newItems) => {
        return newItems;
      },
      forceRefetch({ currentArg, previousArg }) {
        return currentArg !== previousArg;
      }
    }),
    createMessage: builder.mutation<Message, { channelId: number; content: string; attachments?: File[] }>({
      query: ({ channelId, content, attachments = [] }) => {
        const formData = new FormData();
        formData.append('content', content);
        attachments.forEach(file => formData.append('attachments', file));

        return {
          url: `/api/v1/channels/${channelId}/messages`,
          method: 'POST',
          body: formData,
          formData: true
        };
      },
      invalidatesTags: ['Channel']
    }),
    updateMessage: builder.mutation<Message, { channelId: number; messageId: number; content: string }>({
      query: ({ channelId, messageId, content }) => {
        const formData = new FormData();
        formData.append('content', content);

        return {
          url: `/api/v1/channels/${channelId}/messages/${messageId}`,
          method: 'PUT',
          body: formData,
          formData: true
        };
      },
      invalidatesTags: ['Channel']
    }),
    deleteMessage: builder.mutation<void, { channelId: number; messageId: number }>({
      query: ({ channelId, messageId }) => ({
        url: `/api/v1/channels/${channelId}/messages/${messageId}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Channel']
    }),
  }),
});

export const {
  useCreateChannelMutation,
  useUpdateChannelMutation,
  useDeleteChannelMutation,
  useGetMessagesQuery,
  useCreateMessageMutation,
  useUpdateMessageMutation,
  useDeleteMessageMutation
} = channelsApi;