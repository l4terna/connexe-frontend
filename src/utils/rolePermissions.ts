import baseX from 'base-x';

const base62 = baseX('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');

export type PermissionKey = 
  | 'VIEW_CHANNELS'
  | 'MANAGE_CHANNELS'
  | 'MANAGE_ROLES'
  | 'MANAGE_CATEGORIES'
  | 'MANAGE_INVITES'
  | 'SEND_MESSAGES'
  | 'MANAGE_MESSAGES'
  | 'ATTACH_FILES'
  | 'ADD_REACTIONS'
  | 'VOICE_CONNECT'
  | 'SPEAK'
  | 'MUTE_MEMBERS'
  | 'DEAFEN_MEMBERS'
  | 'KICK_MEMBERS'
  | 'BAN_MEMBERS'
  | 'MANAGE_HUB';

export interface Permission {
  key: PermissionKey;
  label: string;
  bit: number;
}

export const PERMISSIONS: Permission[] = [
  { key: 'VIEW_CHANNELS', label: 'Просмотр каналов', bit: 0 },
  { key: 'MANAGE_CHANNELS', label: 'Управление каналами', bit: 1 },
  { key: 'MANAGE_ROLES', label: 'Управление ролями', bit: 2 },
  { key: 'MANAGE_INVITES', label: 'Управление приглашениями', bit: 3 },
  { key: 'SEND_MESSAGES', label: 'Отправлять сообщения', bit: 4 },
  { key: 'MANAGE_MESSAGES', label: 'Управлять сообщениями', bit: 5 },
  { key: 'ATTACH_FILES', label: 'Прикреплять файлы', bit: 6 },
  { key: 'ADD_REACTIONS', label: 'Добавлять реакции', bit: 7 },
  { key: 'VOICE_CONNECT', label: 'Подключаться к голосовому каналу', bit: 8 },
  { key: 'SPEAK', label: 'Говорить в голосовом канале', bit: 9 },
  { key: 'MUTE_MEMBERS', label: 'Отключать микрофон участникам', bit: 10 },
  { key: 'DEAFEN_MEMBERS', label: 'Отключать звук участникам', bit: 11 },
  { key: 'KICK_MEMBERS', label: 'Выгонять участников', bit: 12 },
  { key: 'BAN_MEMBERS', label: 'Банить участников', bit: 13 },
  { key: 'MANAGE_HUB', label: 'Управление хабом', bit: 14 },
  { key: 'MANAGE_CATEGORIES', label: 'Управление категориями', bit: 15 }
];

export function permissionsToBase62(selectedBits: number[]): string {
  if (selectedBits.length === 0) return '0';
  const maxBit = Math.max(...selectedBits, 15);
  const bits = Array(maxBit + 1).fill(0);
  selectedBits.forEach(bit => bits[bit] = 1);
  const byteLen = Math.ceil(bits.length / 8);
  const bytes = new Uint8Array(byteLen);
  bits.forEach((bit, idx) => {
    if (bit) bytes[Math.floor(idx / 8)] |= (1 << (idx % 8));
  });
  return base62.encode(bytes);
}

export function base62ToPermissions(base62Str: string): number[] {
  if (base62Str === '0') return [];
  const bytes = base62.decode(base62Str);
  const bits: number[] = [];
  for (let i = 0; i < bytes.length * 8; i++) {
    if ((bytes[Math.floor(i / 8)] & (1 << (i % 8))) !== 0) bits.push(i);
  }
  return bits;
}

export function hasPermission(permissions: string[], permissionKey: PermissionKey, isOwner: boolean = false): boolean {
  if (isOwner) return true;

  const permission = PERMISSIONS.find(p => p.key === permissionKey);
  if (!permission) return false;
  
  return permissions.some(perm => {
    const bits = base62ToPermissions(perm);
    return bits.includes(permission.bit);
  });
}

export function getMaxPermissions(permissions: string[], isOwner: boolean = false): number[] {
  if (isOwner) {
    return PERMISSIONS.map(p => p.bit);
  }

  const allBits = new Set<number>();
  permissions.forEach(perm => {
    const bits = base62ToPermissions(perm);
    bits.forEach(bit => allBits.add(bit));
  });
  return Array.from(allBits).sort((a, b) => a - b);
}

export function getMaxPermissionsBase62(permissions: string[], isOwner: boolean = false): string {
  const maxBits = getMaxPermissions(permissions, isOwner);
  return permissionsToBase62(maxBits);
}

export function hasAnyPermission(permissions: string[], permissionKeys: PermissionKey[], isOwner: boolean = false): boolean {
  if (isOwner) return true;
  return permissionKeys.some(key => hasPermission(permissions, key));
}

export function hasAllPermissions(permissions: string[], permissionKeys: PermissionKey[], isOwner: boolean = false): boolean {
  if (isOwner) return true;
  return permissionKeys.every(key => hasPermission(permissions, key));
}

export function isHubOwner(isOwner: boolean): boolean {
  return isOwner;
} 