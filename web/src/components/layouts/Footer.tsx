import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import Logo from '@/components/brand/Logo';
import { useLanguage } from '@/contexts/LanguageContext';

const FooterLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <li>
    <Link
      to={to}
      className="group inline-flex items-center gap-1 rounded-2xl px-3 py-2 -ml-3 text-sm text-muted-foreground transition-all duration-200 hover:bg-white/60 hover:text-foreground hover:shadow-sm"
    >
      {children}
      <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 translate-x-0.5 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0" />
    </Link>
  </li>
);

const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/40 bg-white/45 backdrop-blur-xl">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          {/* 品牌区 */}
          <div className="md:col-span-5 lg:col-span-6">
            <Link to="/" className="inline-flex items-center rounded-2xl transition-all duration-200 hover:-translate-y-0.5">
              <Logo size={40} />
            </Link>
            <p className="mt-5 text-sm text-muted-foreground max-w-sm leading-relaxed text-pretty">
              {t.footer.desc}
            </p>
          </div>

          {/* 导航区 */}
          <div className="md:col-span-7 lg:col-span-6">
            <div className="grid grid-cols-2 gap-8 sm:gap-12">
              <div>
                <h4 className="text-sm font-bold mb-4 text-foreground">{t.footer.product}</h4>
                <ul className="space-y-3">
                  <FooterLink to="/features">{t.nav.features}</FooterLink>
                  <FooterLink to="/download">{t.nav.download}</FooterLink>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold mb-4 text-foreground">{t.footer.about}</h4>
                <ul className="space-y-3">
                  <FooterLink to="/about">{t.nav.about}</FooterLink>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 版权区 */}
        <div className="mt-10 md:mt-14 pt-6 border-t border-white/40 text-center sm:text-left">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {t.footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;