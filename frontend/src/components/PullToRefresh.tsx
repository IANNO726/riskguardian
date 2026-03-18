import React, { useState, useRef } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Refresh } from '@mui/icons-material';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 80], [0, 1]);
  const rotate = useTransform(y, [0, 80], [0, 180]);

  const handleDragEnd = async (event: any, info: any) => {
    if (info.offset.y > 80 && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
  };

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      {/* Pull indicator */}
      <motion.div
        style={{
          position: 'absolute',
          top: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          opacity,
        }}
      >
        <Box sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(56,189,248,0.2)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isRefreshing ? (
            <CircularProgress size={20} sx={{ color: '#38bdf8' }} />
          ) : (
            <motion.div style={{ rotate }}>
              <Refresh sx={{ color: '#38bdf8', fontSize: 20 }} />
            </motion.div>
          )}
        </Box>
      </motion.div>

      {/* Draggable content */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ y }}
      >
        {children}
      </motion.div>
    </Box>
  );
};

export default PullToRefresh;

