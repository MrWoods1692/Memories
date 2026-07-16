import React from 'react';
import DynamicIslandHeader from './DynamicIslandHeader';
import Footer from './Footer';
import AnimatedBackground from '@/components/common/AnimatedBackground';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <AnimatedBackground />
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <DynamicIslandHeader />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
};

export default MainLayout;