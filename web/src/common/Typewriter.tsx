import React, { useEffect, useState } from 'react';

interface TypewriterProps {
  text: string;
  className?: string;
  speed?: number;
  startDelay?: number;
  showCursor?: boolean;
}

const Typewriter: React.FC<TypewriterProps> = ({
  text,
  className = '',
  speed = 60,
  startDelay = 0,
  showCursor = true,
}) => {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let index = 0;
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        index += 1;
        setDisplayed(text.slice(0, index));
        if (index >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return (
    <span className={className}>
      {displayed}
      {showCursor && (
        <span className="ml-0.5 inline-block animate-pulse text-primary">|</span>
      )}
    </span>
  );
};

export default Typewriter;