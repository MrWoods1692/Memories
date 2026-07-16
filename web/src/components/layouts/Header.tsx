import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import Logo from '@/components/brand/Logo';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

const Header: React.FC = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const navItems = [
    { name: t.nav.home, path: '/' },
    { name: t.nav.features, path: '/features' },
    { name: t.nav.download, path: '/download' },
    { name: t.nav.about, path: '/about' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/40 bg-white/55 backdrop-blur-xl transition-all duration-300">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center rounded-xl transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5">
          <Logo size={36} />
        </Link>

        {/* 桌面导航 */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-out ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/60 hover:shadow-sm'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <LanguageSwitcher />
          <Button size="sm" asChild>
            <Link to="/download">{t.nav.downloadBtn}</Link>
          </Button>
        </div>

        {/* 移动端菜单 */}
        <div className="flex md:hidden items-center gap-1">
          <LanguageSwitcher />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">导航菜单</SheetTitle>
              <div className="flex flex-col gap-2 mt-8">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={`px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ease-out ${
                      location.pathname === item.path
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/60 hover:shadow-sm'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
                <div className="border-t border-white/40 my-2" />
                <Button className="w-full" asChild onClick={() => setOpen(false)}>
                  <Link to="/download">{t.nav.downloadBtn}</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;