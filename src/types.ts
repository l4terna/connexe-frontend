export interface Category {
  id: number;
  name: string;
  position?: number;
  channels: Channel[];
}

export interface Channel {
  id: number;
  name: string;
  type: ChannelType;
  categoryId: number;
  position?: number;
  isPrivate?: boolean;
  members?: number[];
}

export enum ChannelType {
  VOICE = 0,
  TEXT = 1,
  ANNOUNCEMENT = 2,
  FORUM = 3
} 