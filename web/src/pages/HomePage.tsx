import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import Typewriter from '@/components/common/Typewriter';
import { useLoading } from '@/components/common/LoadingScreen';
import {
  Camera, Upload, Settings, Share2, Download, Palette,
  ArrowRight, ChevronRight, Layers
} from 'lucide-react';
import { AndroidIcon, AppleIcon, WindowsIcon, MacOsIcon, LinuxIcon } from '@/components/common/SystemIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MainLayout from '@/components/layouts/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';

const heroPhotos = [
  { src: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_208e4d71-f314-4991-8da6-846b5ff2c88a.jpg', alt: '校园操场', className: 'col-span-2 row-span-2' },
  { src: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_6345f1da-c801-4e47-8009-e66fdb42edcf.jpg', alt: '教学楼', className: 'col-span-1 row-span-1' },
  { src: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_d3844638-4216-4f70-81bd-6615a4a63c6c.jpg', alt: '图书馆', className: 'col-span-1 row-span-1' },
  { src: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_3f6d233f-f1fc-4e45-90db-e59df1e4ea05.jpg', alt: '运动会', className: 'col-span-1 row-span-1' },
  { src: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_c20602b2-ecc6-4659-a994-3124e082104e.jpg', alt: '毕业照', className: 'col-span-1 row-span-1' },
];

const HomePage: React.FC = () => {
  const { t } = useLanguage();
  const loading = useLoading();
  const typewriterDelay = loading ? 99999 : 800;

  const features = [
    { icon: Camera, title: t.featuresOverview.items[0].title, desc: t.featuresOverview.items[0].desc, hover: 'group-hover:bg-[hsl(175,60%,45%)] group-hover:text-white' },
    { icon: Upload, title: t.featuresOverview.items[1].title, desc: t.featuresOverview.items[1].desc, hover: 'group-hover:bg-[hsl(30,85%,55%)] group-hover:text-white' },
    { icon: Share2, title: t.featuresOverview.items[2].title, desc: t.featuresOverview.items[2].desc, hover: 'group-hover:bg-[hsl(262,55%,58%)] group-hover:text-white' },
    { icon: Palette, title: t.featuresOverview.items[3].title, desc: t.featuresOverview.items[3].desc, hover: 'group-hover:bg-[hsl(345,75%,58%)] group-hover:text-white' },
    { icon: Settings, title: t.featuresOverview.items[4].title, desc: t.featuresOverview.items[4].desc, hover: 'group-hover:bg-[hsl(200,60%,48%)] group-hover:text-white' },
    { icon: Download, title: t.featuresOverview.items[5].title, desc: t.featuresOverview.items[5].desc, hover: 'group-hover:bg-[hsl(45,80%,50%)] group-hover:text-white' },
  ];

  const platforms = [
    { Icon: AndroidIcon, name: 'Android' },
    { Icon: AppleIcon, name: 'iOS' },
    { Icon: WindowsIcon, name: 'Windows' },
    { Icon: MacOsIcon, name: 'macOS' },
    { Icon: LinuxIcon, name: 'Linux' },
  ];

  return (
    <MainLayout>
      {/* Hero */}
      <section className="relative overflow-hidden paper-texture">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-1/3 -left-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="container relative mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="secondary" className="mb-4 text-xs">
                {t.hero.badge}
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight text-balance tracking-tight">
                <Typewriter text={t.hero.title1} speed={70} startDelay={typewriterDelay} showCursor={false} />
                <span className="text-primary">
                  <Typewriter text={t.hero.title2} speed={70} startDelay={typewriterDelay + t.hero.title1.length * 70 + 200} />
                </span>
              </h1>
              <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-prose text-pretty">
                {t.hero.desc}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/download">
                    {t.hero.cta1}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/features">{t.hero.cta2}</Link>
                </Button>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-4 max-w-sm">
                {t.hero.stats.map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-2xl md:text-3xl font-bold text-primary">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* 照片墙 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-3 grid-rows-3 gap-3 aspect-square"
            >
              {heroPhotos.map((photo, i) => (
                <div
                  key={i}
                  className={`photo-frame photo-frame-hover overflow-hidden ${photo.className}`}
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="w-full h-full object-cover rounded-sm"
                    loading="lazy"
                  />
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* 功能概览 */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.featuresOverview.title}</h2>
            <p className="mt-3 text-muted-foreground text-pretty">{t.featuresOverview.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <Card className="h-full  duration-300 group">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-2xl bg-white/60 border border-white/50 flex items-center justify-center mb-4 transition-colors ${f.hover}`}>
                      <f.icon className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button variant="outline" asChild>
              <Link to="/features">
                {t.featuresOverview.viewAll}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 多端下载 */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.platforms.title}</h2>
            <p className="mt-3 text-muted-foreground text-pretty">{t.platforms.subtitle}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {platforms.map((p) => (
              <Card key={p.name} className="w-36 text-center">
                <CardContent className="p-6 flex flex-col items-center gap-3">
                  <p.Icon className="h-10 w-10" />
                  <span className="text-sm font-medium">{p.name}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button size="lg" asChild>
              <Link to="/download">
                {t.platforms.downloadCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 一校一包 */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[hsl(175,40%,88%)] via-[hsl(160,38%,92%)] to-[hsl(30,40%,90%)]">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5" />
            <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.school.title}</h2>
          </div>
          <p className="text-muted-foreground max-w-prose mx-auto mb-8 text-pretty">
            {t.school.desc}
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/download">
              {t.nav.downloadBtn}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MainLayout>
  );
};

export default HomePage;