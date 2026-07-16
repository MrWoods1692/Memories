import React from 'react';

const AnimatedBackground: React.FC = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* 静态径向渐变背景：从 #fdfcfb 到 #e2d1c3，不再随滚动变换 */}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--gradient-background)' }}
      />
      {/* 多彩柔和光斑，低饱和度避免干扰主体 */}
      <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-[hsl(344,87%,82%)]/25 blur-3xl animate-blob" />
      <div className="absolute top-1/3 -left-24 h-96 w-96 rounded-full bg-[hsl(198,88%,78%)]/25 blur-3xl animate-blob animation-delay-2000" />
      <div className="absolute bottom-1/4 right-1/3 h-80 w-80 rounded-full bg-[hsl(166,68%,78%)]/22 blur-3xl animate-blob animation-delay-4000" />
      <div className="absolute top-2/3 right-0 h-72 w-72 rounded-full bg-[hsl(262,70%,82%)]/20 blur-3xl animate-blob animation-delay-1000" />
      <div className="absolute inset-0 film-grain opacity-[0.03] paper-texture" />
    </div>
  );
};

export default AnimatedBackground;