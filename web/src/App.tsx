import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { LanguageProvider } from '@/contexts/LanguageContext';
import LoadingScreen, { useLoading } from '@/components/common/LoadingScreen';
import CustomCursor from '@/components/common/CustomCursor';

import { routes } from './routes';

const pageVariants = {
  initial: { opacity: 0, y: 18, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -14, filter: 'blur(3px)' },
};

const pageTransition = {
  duration: 0.45,
  ease: [0.4, 0, 0.2, 1] as const,
};

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  const loading = useLoading();
  const [showRoutes, setShowRoutes] = useState(false);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setShowRoutes(true), 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading]);

  return (
    <AnimatePresence mode="wait">
      {showRoutes && (
        <motion.div
          key={location.pathname}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={pageTransition}
        >
          <Routes location={location}>
            {routes.map((route, index) => (
              <Route key={index} path={route.path} element={route.element} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <Router>
        <LoadingScreen>
          <ScrollToTop />
          <CustomCursor />
          <IntersectObserver />
          <AnimatedRoutes />
          <Toaster />
        </LoadingScreen>
      </Router>
    </LanguageProvider>
  );
};

export default App;
