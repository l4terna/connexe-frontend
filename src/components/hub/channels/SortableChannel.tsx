import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Channel } from '../../../api/channels';
import { hasPermission, PermissionKey } from '../../../utils/rolePermissions';

interface SortableChannelProps {
  channel: Channel;
  children: React.ReactNode;
  userPermissions: string[];
  isOwner: boolean;
}

const SortableChannel: React.FC<SortableChannelProps> = ({ 
  channel, 
  children,
  userPermissions,
  isOwner 
}) => {
  const canManageChannels = isOwner || hasPermission(userPermissions, 'MANAGE_CHANNELS' as PermissionKey);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: channel.id,
    disabled: !canManageChannels 
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
        cursor: canManageChannels ? 'grab' : 'default',
      }}
      {...(canManageChannels ? { ...attributes, ...listeners } : {})}
    >
      {children}
    </div>
  );
};

export default SortableChannel; 