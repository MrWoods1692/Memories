import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, ExternalLink, Eye, Menu, X } from 'lucide-react';
import { toast } from 'sonner';
import Logo from '@/components/brand/Logo';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

type IslandMode = 'idle' | 'nav' | 'selection';

interface SelectionContext {
  type: 'text' | 'link' | 'image';
  text: string;
  url?: string;
  imageSrc?: string;
}

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+(\/[^\s]*)?$/.test(trimmed)) return `https://${trimmed}`;
  return null;
};

const DynamicIslandHeader: React.FC = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const [mode, setMode] = useState<IslandMode>('idle');
  const [selection, setSelection] = useState<SelectionContext | null>(null);
  const [copied, setCopied] = useState(false);
  const islandRef = useRef<HTMLDivElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navItems = useMemo(
    () => [
      { name: t.nav.home, short: t.nav.home, path: '/' },
      { name: t.nav.features, short: '功能', path: '/features' },
      { name: t.nav.download, short: '下载', path: '/download' },
      { name: t.nav.about, short: t.nav.about, path: '/about' },
    ],
    [t.nav],
  );

  const resetCopied = useCallback(() => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1600);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!selection?.text) return;
    try {
      await navigator.clipboard.writeText(selection.text);
      setCopied(true);
      resetCopied();
      toast.success('已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }, [selection, resetCopied]);

  const handleOpenLink = useCallback(() => {
    if (!selection?.url) return;
    window.open(selection.url, '_blank', 'noopener,noreferrer');
  }, [selection]);

  const handleViewImage = useCallback(() => {
    if (!selection?.imageSrc) return;
    window.open(selection.imageSrc, '_blank', 'noopener,noreferrer');
  }, [selection]);

  useEffect(() => {
    const handleSelection = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;

      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!text || text.length < 1) {
        setSelection(null);
        setMode((current) => (current === 'selection' ? 'idle' : current));
        return;
      }

      const anchorNode = sel?.anchorNode;
      const target = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
      const link = target?.closest('a') ?? null;
      const image = target?.closest('img') ?? null;
      const inferredUrl = normalizeUrl(text);

      if (link) {
        setSelection({ type: 'link', text, url: link.href });
      } else if (image) {
        setSelection({ type: 'image', text, imageSrc: image.currentSrc || image.src });
      } else if (inferredUrl) {
        setSelection({ type: 'link', text, url: inferredUrl });
      } else {
        setSelection({ type: 'text', text });
      }
      setMode('selection');
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!islandRef.current?.contains(event.target as Node)) return;
      if (mode !== 'selection') event.preventDefault();
    };

    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [mode]);

  useEffect(() => {
    setMode('idle');
    setSelection(null);
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const toggleNav = () => setMode((current) => (current === 'nav' ? 'idle' : 'nav'));

  const islandVariants = {
    idle: { maxWidth: 360 },
    nav: { maxWidth: 720 },
    selection: { maxWidth: 520 },
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!islandRef.current || islandRef.current.contains(event.target as Node)) return;
      setMode((current) => (current !== 'idle' ? 'idle' : current));
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full px-3 pt-3 md:px-6 md:pt-4">
      <motion.div
        ref={islandRef}
        initial={false}
        animate={islandVariants[mode]}
        transition={{ type: 'spring', stiffness: 120, damping: 22, mass: 1.3 }}
        className="mx-auto flex h-14 w-full max-w-[1100px] items-center justify-between overflow-hidden rounded-full border border-white/60 bg-gradient-card px-3 shadow-card backdrop-blur-2xl md:h-16 md:px-4"
      >
        <Link
          to="/"
          onClick={() => setMode('idle')}
          className="flex min-w-0 items-center gap-2 rounded-full px-1 py-1 shrink-0 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5"
        >
          <Logo size={34} showText={false} />
          <span className={`truncate text-lg font-bold tracking-tight transition-all duration-300 ${mode === 'nav' ? 'max-w-0 sm:max-w-xs opacity-0 sm:opacity-100' : 'max-w-xs opacity-100'}`} style={{ fontFamily: "'Noto Serif SC', serif" }}>
            Memories
          </span>
        </Link>

        <div className="flex min-w-0 items-center justify-end gap-1 md:gap-2">
          <AnimatePresence mode="wait" initial={false}>
            {mode === 'selection' && selection ? (
              <motion.div
                key="selection"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex min-w-0 items-center gap-1"
              >
                <span className="hidden max-w-[120px] truncate px-2 text-xs text-muted-foreground sm:inline">
                  {selection.text}
                </span>
                {selection.type === 'text' && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex h-9 items-center gap-1 rounded-full bg-gradient-warm px-3 text-xs font-semibold text-[#0a2a52] shadow-sm transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                )}
                {selection.type === 'link' && (
                  <button
                    type="button"
                    onClick={handleOpenLink}
                    className="inline-flex h-9 items-center gap-1 rounded-full bg-gradient-warm px-3 text-xs font-semibold text-emerald-700 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    打开链接
                  </button>
                )}
                {selection.type === 'image' && (
                  <button
                    type="button"
                    onClick={handleViewImage}
                    className="inline-flex h-9 items-center gap-1 rounded-full bg-gradient-warm px-3 text-xs font-semibold text-white shadow-sm transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    查看
                  </button>
                )}
              </motion.div>
            ) : mode === 'nav' ? (
              <motion.nav
                key="nav"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex min-w-0 items-center gap-1 rounded-2xl bg-gradient-card p-1 backdrop-blur-md"
              >
                {navItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMode('idle')}
                      className={`relative whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ease-out ${
                        active
                          ? 'bg-gradient-warm text-orange-400 shadow-sm'
                          : 'text-muted-foreground hover:bg-white/70 hover:text-foreground hover:shadow-sm'
                      }`}
                    >
                      <span className="hidden sm:inline">{item.name}</span>
                      <span className="sm:hidden">{item.short}</span>
                    </Link>
                  );
                })}
                <LanguageSwitcher />
              </motion.nav>
            ) : (
              <motion.button
                key="trigger"
                type="button"
                onClick={toggleNav}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-warm px-3 text-sm font-medium text-yellow-400 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:shadow-md"
              >
                <Menu className="hidden h-4 w-4 sm:inline" />
                <span>导航</span>
              </motion.button>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </header>
  );
};

export default DynamicIslandHeader;
