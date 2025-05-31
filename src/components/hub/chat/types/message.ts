// Shared message type definitions
export enum MessageStatus {
  SENT = 0,
  READ = 1,
  NEW = 2
}

export interface Message {
  id: number;
  content: string;
  author: {
    id: number;
    login: string;
    avatar: string | null;
  };
  created_at: string;
  last_modified_at?: string;
  attachments: string[];
  read_by_count?: number;
  reply?: ExtendedMessage | null;
}

export interface ReplyMessage {
  id: number;
  content: string;
  attachments_count: number;
  author: {
    id: number;
    login: string;
    avatar: string | null;
  };
  channel_id: number;
}

export interface ExtendedMessage extends Message {
  status: MessageStatus;
  channel_id?: number;
  reply_to?: number | null;
}
