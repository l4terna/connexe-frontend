export const ROUTES = {
  HOME: '/',
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
  },
  HUB: {
    BASE: '/hub',
    DETAIL: (hubId: string | number) => `/hub/${hubId}`,
    CHANNEL: (hubId: string | number, channelId: string | number) => `/hub/${hubId}/channel/${channelId}`,
    SETTINGS: (hubId: string | number) => `/hub/${hubId}/settings`,
  },
  SIDEBAR_EXPERIMENT: '/sidebar-experiment',
} as const;