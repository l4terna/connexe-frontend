import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';

interface MultiTabsProps {
  tabs: { id: string; label: string }[];
  onAddTab?: () => void;
}

const MultiTabs: React.FC<MultiTabsProps> = ({ tabs, onAddTab }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    navigate(`/hub/${tabs[newValue].id}`);
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTabs-indicator': {
            background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
            height: '3px',
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'slideIndicator 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            '@keyframes slideIndicator': {
              '0%': {
                transform: `translateX(${(activeTab - 1) * 100}%)`,
              },
              '100%': {
                transform: `translateX(${activeTab * 100}%)`,
              },
            },
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            WebkitTransform: 'translateZ(0)',
            WebkitPerspective: '1000',
          },
          '& .MuiTabs-flexContainer': {
            position: 'relative',
            zIndex: 1,
          }
        }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            label={
              <Typography
                sx={{
                  color: activeTab === tabs.indexOf(tab) ? '#FF69B4' : '#B0B0B0',
                  fontWeight: 700,
                  transition: 'color 0.3s ease',
                }}
              >
                {tab.label}
              </Typography>
            }
          />
        ))}
      </Tabs>
      {onAddTab && (
        <IconButton
          onClick={onAddTab}
          sx={{
            ml: 1,
            color: '#FF69B4',
            '&:hover': {
              background: 'rgba(255,105,180,0.1)',
            },
          }}
        >
          <AddIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default MultiTabs;