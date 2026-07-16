import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Typewriter from '@/components/common/Typewriter';
import { useLoading } from '@/components/common/LoadingScreen';
import { Heart, Users, Shield, Sparkles, ArrowRight, Github, Scale, ExternalLink, CalendarDays, Clock, Globe, School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MainLayout from '@/components/layouts/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';

const LAUNCH_TIME = new Date('2026-07-04T00:00:00');

interface Uptime {
  years: number;
  days: number;
  hours: number;
  minutes: number;
}

function calcUptime(): Uptime {
  const now = new Date();
  let diff = Math.max(0, now.getTime() - LAUNCH_TIME.getTime());
  const minutes = Math.floor(diff / 60000) % 60;
  diff = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 60) % 24;
  diff = Math.floor(diff / 60);
  const days = Math.floor(diff / 24) % 365;
  const years = Math.floor(diff / (24 * 365));
  return { years, days, hours, minutes };
}

const AboutPage: React.FC = () => {
  const { t } = useLanguage();
  const loading = useLoading();
  const [uptime, setUptime] = useState<Uptime>(calcUptime);

  useEffect(() => {
    const timer = setInterval(() => setUptime(calcUptime()), 60000);
    return () => clearInterval(timer);
  }, []);

  const values = [
    { icon: Heart, title: t.aboutPage.values[0].title, desc: t.aboutPage.values[0].desc },
    { icon: Users, title: t.aboutPage.values[1].title, desc: t.aboutPage.values[1].desc },
    { icon: Shield, title: t.aboutPage.values[2].title, desc: t.aboutPage.values[2].desc },
    { icon: Sparkles, title: t.aboutPage.values[3].title, desc: t.aboutPage.values[3].desc },
  ];

  const uptimeItems = [
    { value: uptime.years, label: '年' },
    { value: uptime.days, label: '日' },
    { value: uptime.hours, label: '时' },
    { value: uptime.minutes, label: '分' },
  ];

  return (
    <MainLayout>
      {/* 页面头部 */}
      <section className="paper-texture py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <Badge variant="secondary" className="mb-4">{t.aboutPage.badge}</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-balance tracking-tight min-h-[2.5rem] md:min-h-[3rem]">
            {loading ? null : <Typewriter text={t.aboutPage.title} speed={60} startDelay={600} showCursor={false} />}
          </h1>
          <p className="mt-4 text-muted-foreground max-w-prose mx-auto text-pretty">
            {t.aboutPage.subtitle}
          </p>
        </div>
      </section>

      {/* 使命 */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-balance">{t.aboutPage.missionTitle}</h2>
            <p className="text-muted-foreground leading-relaxed text-lg text-pretty">
              {t.aboutPage.missionText}
            </p>
          </div>
        </div>
      </section>

      {/* 核心价值 */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.aboutPage.valuesTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <Card key={v.title} className="h-full text-center  group">
                <CardContent className="p-6 flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-white/60 border border-white/50 flex items-center justify-center group-hover:bg-primary transition-colors">
                    <v.icon className="h-7 w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <h3 className="font-semibold">{v.title}</h3>
                  <p className="text-sm text-muted-foreground text-pretty">{v.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 学校合作 */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-balance">{t.aboutPage.schoolTitle}</h2>
            <p className="text-muted-foreground mb-8 text-pretty">
              {t.aboutPage.schoolText}
            </p>
            <div className="inline-flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-8 py-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(175,55%,45%)] to-[hsl(160,50%,40%)] flex items-center justify-center shadow-md">
                <School className="h-7 w-7 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg">{t.school.name}</p>
                <p className="text-sm text-muted-foreground">{t.aboutPage.schoolStatus}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 开源项目 + 开发者 */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 mb-2">
                <Github className="h-6 w-6 text-primary" />
                <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.aboutPage.openSourceTitle}</h2>
              </div>
              <p className="text-muted-foreground text-pretty">{t.aboutPage.openSourceDesc}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 仓库卡片 */}
              <Card className="">
                <CardContent className="p-6 flex flex-col gap-4 h-full">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/60 border border-white/50 flex items-center justify-center shrink-0">
                      <Github className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold break-words">{t.aboutPage.repo}</h3>
                      <span className="text-xs text-muted-foreground">github.com</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1 w-fit">
                    <Scale className="h-3 w-3" />
                    {t.aboutPage.license}
                  </Badge>
                  <Button variant="outline" size="sm" asChild className="mt-auto w-fit">
                    <a href="https://github.com/idoknow/Memories-Client" target="_blank" rel="noopener noreferrer">
                      {t.aboutPage.viewRepo}
                      <ExternalLink className="ml-1 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* 开发者卡片 */}
              <Card className="">
                <CardContent className="p-6 flex flex-col gap-4 h-full">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://img.cdn1.vip/i/6a00223138677_1778393649.webp"
                      alt={t.aboutPage.developerName}
                      className="w-12 h-12 rounded-full object-cover border border-white/40 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t.aboutPage.developerTitle}</p>
                      <h3 className="font-bold break-words">{t.aboutPage.developerName}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="h-4 w-4 shrink-0" />
                    <span className="break-all">{t.aboutPage.developerHome}</span>
                  </div>
                  <Button variant="outline" size="sm" asChild className="mt-auto w-fit">
                    <a href="https://mrcwoods.com" target="_blank" rel="noopener noreferrer">
                      {t.aboutPage.developerHomeLabel}
                      <ExternalLink className="ml-1 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* 项目时间线 */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 mb-2">
                <Clock className="h-6 w-6 text-primary" />
                <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.aboutPage.timelineTitle}</h2>
              </div>
            </div>
            <Card className="">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-white/60 border border-white/50 flex items-center justify-center shrink-0">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.aboutPage.launchDateLabel}</p>
                    <p className="font-bold text-lg">{t.aboutPage.launchDate}</p>
                  </div>
                </div>
                <div className="border-t border-white/40 pt-6">
                  <p className="text-sm text-muted-foreground mb-4">{t.aboutPage.uptimeLabel}</p>
                  <div className="grid grid-cols-4 gap-3">
                    {uptimeItems.map((item, i) => {
                      const colors = [
                        'bg-gradient-to-b from-[hsl(175,50%,90%)] to-[hsl(175,40%,84%)] border-[hsl(175,40%,70%)] text-[hsl(175,55%,38%)]',
                        'bg-gradient-to-b from-[hsl(30,50%,92%)] to-[hsl(30,45%,86%)] border-[hsl(30,45%,72%)] text-[hsl(25,55%,42%)]',
                        'bg-gradient-to-b from-[hsl(262,40%,93%)] to-[hsl(262,35%,88%)] border-[hsl(262,35%,74%)] text-[hsl(262,45%,42%)]',
                        'bg-gradient-to-b from-[hsl(200,45%,92%)] to-[hsl(200,40%,86%)] border-[hsl(200,40%,70%)] text-[hsl(200,50%,40%)]',
                      ];
                      return (
                        <div key={item.label} className={`text-center rounded-2xl border backdrop-blur-sm p-3 shadow-sm ${colors[i]}`}>
                          <p className="text-2xl md:text-3xl font-bold tabular-nums">{String(item.value).padStart(2, '0')}</p>
                          <p className="text-xs opacity-60 mt-1 font-medium">{item.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-balance">{t.aboutPage.ctaTitle}</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-prose mx-auto text-pretty">
            {t.aboutPage.ctaText}
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/download">
              {t.aboutPage.ctaBtn}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MainLayout>
  );
};

export default AboutPage;