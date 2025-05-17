import React, { useState } from 'react';
import { Avatar, AvatarProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { createPortal } from 'react-dom';
import UserProfileContainer from './hub/members/UserProfileContainer';

const StyledUserAvatar = styled(Avatar)<AvatarProps>(({ theme }) => ({
  width: 40,
  height: 40,
  position: 'relative',
  background: 'linear-gradient(135deg, #8e1450 0%, #1976D2 100%)',
  fontSize: '1.4rem',
  fontWeight: 700,
  color: '#fff',
  transition: 'all 0.3s',
  cursor: 'pointer',
  lineHeight: '40px', // Same as height for vertical centering
  textAlign: 'center',
  '&:hover': {
    borderColor: 'transparent',
    transform: 'scale(1.05)',
    cursor: 'pointer',
  },
}));

interface UserAvatarProps extends AvatarProps {
  userId?: number;
  hubId?: number;
  disableClick?: boolean;
}

const UserAvatar: React.FC<UserAvatarProps> = (props) => {
  const { src, alt, userId, hubId, disableClick, ...rest } = props;
  const [anchorPoint, setAnchorPoint] = useState<{ x: number; y: number } | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!userId || !hubId || disableClick) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchorPoint({
      x: rect.left + window.scrollX - 300,
      y: rect.top + window.scrollY
    });
  };

  const handleClose = () => {
    setAnchorPoint(null);
  };

  return (
    <>
      <StyledUserAvatar
        src={src}
        alt={alt}
        onClick={handleClick}
        {...rest}
        sx={{
          ...rest.sx,
          '& .MuiAvatar-img': {
            objectFit: 'cover'
          }
        }}
      >
        {!src && (alt && alt.length > 0) ? (
          <span style={{ 
            lineHeight: 1,
            display: 'inline-block', 
            verticalAlign: 'middle',
            position: 'relative',
            top: '3px' // Fine-tune vertical positioning
          }}>
            {alt[0].toUpperCase()}
          </span>
        ) : '?'}
      </StyledUserAvatar>
      {!!(userId && hubId && anchorPoint) && createPortal(
        <UserProfileContainer
          userId={userId}
          hubId={hubId}
          anchorPoint={anchorPoint}
          onClose={handleClose}
        />,
        document.body
      )}
    </>
  );
};

export default UserAvatar;