import { api } from './api';
import { User } from './users';

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
  created_at: string;
  attachments: string[];
  last_modified_at?: string;
  read_by_count?: number;
}

export interface GetMessagesParams {
  before?: number;
  after?: number;
  around?: number;
  size?: number;
}

export const channelsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createChannel: builder.mutation<Channel, { hubId: number; categoryId: number; data: CreateChannelDto }>({
      query: ({ hubId, data }) => ({
        url: `/api/v1/hubs/${hubId}/channels`,
        method: 'POST',
        body: {
          ...data,
          category_id: data.categoryId
        }
      }),
      invalidatesTags: ['Channel']
    }),
    updateChannel: builder.mutation<Channel, { channelId: number; data: Partial<Channel> & { category_id?: number } }>({
      query: ({ channelId, data }) => ({
        url: `/api/v1/channels/${channelId}`,
        method: 'PUT',
        body: data
      }),
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

export type Category = {
  id: string | number;
  name: string;
  channels: Channel[];
}; 