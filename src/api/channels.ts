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
  reply?: Message; // Message that this message is replying to (API uses 'reply' field)
}

export interface GetMessagesParams {
  before?: number;
  after?: number;
  around?: number;
  size?: number;
  search?: string; // Параметр для поиска сообщений
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
        // Если это поиск, не сериализуем только по channelId, чтобы иметь разные кэши для разных поисковых запросов
        if (queryArgs.params?.search) {
          return `${queryArgs.channelId}_search_${queryArgs.params.search}`;
        }
        return queryArgs.channelId;
      },
      merge: (currentCache, newItems) => {
        return newItems;
      },
      forceRefetch({ currentArg, previousArg }) {
        return currentArg !== previousArg;
      }
    }),
    searchMessages: builder.query<Message[], { channelId: number; search: string; size?: number }>({
      query: ({ channelId, search, size = 20 }) => ({
        url: `/api/v1/channels/${channelId}/messages`,
        params: { search, size }
      }),
      keepUnusedDataFor: 60, // Кэшировать результаты поиска 1 минуту
    }),
    createMessage: builder.mutation<Message, { channelId: number; content: string; attachments?: File[]; replyId?: number }>({
      query: ({ channelId, content, attachments = [], replyId }) => {
        console.log('createMessage called with params:', {
          channelId,
          content,
          replyId,
          replyIdType: typeof replyId,
          hasAttachments: attachments.length > 0
        });
        
        const formData = new FormData();
        formData.append('content', content);
        
        // Ensure replyId is properly added to FormData
        if (replyId !== undefined && replyId !== null) {
          console.log('Adding replyId to FormData:', replyId);
          formData.append('replyId', replyId.toString());
        } else {
          console.log('replyId is not provided:', { replyId, isUndefined: replyId === undefined, isNull: replyId === null });
        }
        
        attachments.forEach(file => formData.append('attachments', file));

        // Log all FormData entries for debugging
        console.log('Final FormData entries:');
        for (let [key, value] of formData.entries()) {
          console.log(`  ${key}: ${value}`);
        }

        return {
          url: `/api/v1/channels/${channelId}/messages`,
          method: 'POST',
          body: formData
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
          body: formData
        };
      },
      invalidatesTags: ['Channel']
    }),
    deleteMessage: builder.mutation<void, { channelId: number; messageId: number; forEveryone?: boolean }>({
      query: ({ channelId, messageId, forEveryone }) => ({
        url: `/api/v1/channels/${channelId}/messages/${messageId}`,
        method: 'DELETE',
        params: forEveryone ? { for_everyone: true } : undefined
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
  useSearchMessagesQuery,
  useCreateMessageMutation,
  useUpdateMessageMutation,
  useDeleteMessageMutation
} = channelsApi;