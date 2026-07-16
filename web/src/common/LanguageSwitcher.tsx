import React from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { languages, type Language } from '@/lib/i18n';

const langColors: Record<string, string> = {
  zh: 'bg-[hsl(175,55%,45%)]/10 text-[hsl(175,55%,42%)] font-medium',
  'zh-TW': 'bg-[hsl(30,80%,55%)]/10 text-[hsl(30,80%,48%)] font-medium',
  en: 'bg-[hsl(220,60%,50%)]/10 text-[hsl(220,60%,45%)] font-medium',
  ja: 'bg-[hsl(340,65%,55%)]/10 text-[hsl(340,65%,50%)] font-medium',
};

const LanguageSwitcher: React.FC = () => {
  const { lang, setLang } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full bg-gradient-card text-foreground shadow-sm backdrop-blur-md transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md"
        >
          <Globe className="h-[1.15rem] w-[1.15rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code as Language)}
            className={lang === l.code ? langColors[l.code] : ''}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;