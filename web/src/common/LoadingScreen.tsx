import React, { useEffect, useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from '@/components/brand/Logo';

const LoadingContext = createContext<boolean>(true);

export const useLoading = () => useContext(LoadingContext);

const LoadingScreen: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LoadingContext.Provider value={visible}>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-xl"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <Logo size={72} />
            </motion.div>
            <motion.div
              className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/60 border border-white/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
              />
            </motion.div>
            <motion.p
              className="mt-4 text-sm text-muted-foreground tracking-widest"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              MEMORIES
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </LoadingContext.Provider>
  );
};

export default LoadingScreen;