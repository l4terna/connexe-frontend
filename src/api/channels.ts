import { api } from '@/api/api';
import { User } from '@/api/users';

export enum ChannelType {
  VOICE = 0,
  TEXT = 1,
  PRIVATE = 2
}

export interface Channel {
  id: number;
  name: string;
  type: ChannelType;
  categoryId: number;
  position?: number;
  isDeleted?: boolean;
}

export interface PrivateChannel {
  id: number;
  name: string | null;
  type: number;
  category_id: number | null;
  position: number | null;
  members?: User[];
  lastMessage?: Message;
  createdAt?: string;
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
    getPrivateChannels: builder.query<PrivateChannel[], void>({
      query: () => ({
        url: `/api/v1/channels`,
        method: 'GET',
      }),
      transformResponse: (response: any) => {
        // Handle different possible response formats
        if (Array.isArray(response)) {
          return response;
        }
        // If response has a 'data' property that's an array
        if (response?.data && Array.isArray(response.data)) {
          return response.data;
        }
        // If response has a 'content' property (paginated response)
        if (response?.content && Array.isArray(response.content)) {
          return response.content;
        }
        // If response is null/undefined or not in expected format
        console.warn('Unexpected response format for getPrivateChannels:', response);
        return [];
      },
      providesTags: ['Channel'],
    }),
    getPrivateChannelDetails: builder.query<PrivateChannel & { members: User[] }, number>({
      query: (channelId) => ({
        url: `/api/v1/channels/${channelId}`,
        method: 'GET',
      }),
      providesTags: ['Channel'],
    }),
    createPrivateChannel: builder.mutation<PrivateChannel, { members: number[] }>({
      query: ({ members }) => ({
        url: `/api/v1/channels`,
        method: 'POST',
        body: { members }
      }),
      invalidatesTags: ['Channel']
    }),
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
        const apiData: any = { ...data };
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
        // Include the around parameter in the cache key for message navigation
        if (queryArgs.params?.around) {
          return `${queryArgs.channelId}_around_${queryArgs.params.around}`;
        }
        // Include the before parameter in the cache key to ensure different pages are cached separately
        if (queryArgs.params?.before) {
          return `${queryArgs.channelId}_before_${queryArgs.params.before}`;
        }
        // Include the after parameter in the cache key for gap filling
        if (queryArgs.params?.after) {
          return `${queryArgs.channelId}_after_${queryArgs.params.after}`;
        }
        // Basic channel ID for initial load - without timestamp to avoid constant refetching
        return `${queryArgs.channelId}_initial`;
      },
      merge: (_currentCache, newItems) => {
        return newItems;
      },
      forceRefetch({ currentArg, previousArg }) {
        // Always refetch if the channel ID changes
        if (currentArg?.channelId !== previousArg?.channelId) {
          return true;
        }
        
        // Force refetch for pagination queries
        if (currentArg?.params?.after !== previousArg?.params?.after) {
          return true;
        }

        if (currentArg?.params?.before !== previousArg?.params?.before) {
          return true;
        }
        
        // Force refetch for around queries
        if (currentArg?.params?.around !== previousArg?.params?.around) {
          return true;
        }
        
        // Force refetch for search queries
        if (currentArg?.params?.search !== previousArg?.params?.search) {
          return true;
        }
        
        // Don't refetch if only size parameter is present and hasn't changed
        return false;
      }, 
  
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
        const formData = new FormData();
        formData.append('content', content);
        
        // Ensure replyId is properly added to FormData
        if (replyId !== undefined && replyId !== null) {
          formData.append('replyId', replyId.toString());
        } 
        
        attachments.forEach(file => formData.append('attachments', file));
        
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
  useGetPrivateChannelsQuery,
  useGetPrivateChannelDetailsQuery,
  useCreatePrivateChannelMutation,
  useCreateChannelMutation,
  useUpdateChannelMutation,
  useDeleteChannelMutation,
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useSearchMessagesQuery,
  useCreateMessageMutation,
  useUpdateMessageMutation,
  useDeleteMessageMutation
} = channelsApi;