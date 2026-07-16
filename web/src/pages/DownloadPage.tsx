import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Download, CheckCircle2,
  Shield, Package, School, ChevronRight, FileText, HardDrive, CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MainLayout from '@/components/layouts/MainLayout';
import { AndroidIcon, AppleIcon, WindowsIcon, MacOsIcon, LinuxIcon } from '@/components/common/SystemIcons';
import { useLanguage } from '@/contexts/LanguageContext';

const SCHOOL_LOGO = 'https://cloudflarecnimg.scdn.io/i/6a34e75125111_1781851985.png';

// 👇 新增下载链接映射（请替换为你的真实地址）
const DOWNLOAD_URLS: Record<string, Record<string, Record<string, string>>> = {
  'guilin-kuiguang': {
    android: {
      apk: 'https://github.com/idoknow/Memories-Client/releases/download/v1.1.0/Memories-v1.1.0.apk',
    },
    ios: {
      pwa: 'https://memories-ios.mrcwoods.com/', // 或具体的 PWA 安装指引页
    },
    windows: {
      exe: 'https://github.com/idoknow/Memories-Client/releases/download/1.1.2/Memories-1.1.2-win64.exe',
    },
    macos: {
      dmg: '#',
    },
    linux: {
      deb: 'https://github.com/idoknow/Memories-Client/releases/download/v1.1.1/memories-1.1.1-Linux.deb',
      rpm: 'https://github.com/idoknow/Memories-Client/releases/download/v1.1.1/memories-1.1.1-Linux.rpm',
    },
  },
};

interface Platform {
  icon: React.FC<{ className?: string }>;
  name: string;
  desc: string;
  version: string;
  size: string;
  updated: string;
  downloads: { label: string; format: string }[];
}

const DownloadPage: React.FC = () => {
  const { t } = useLanguage();
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);

  const schools = [
    { id: 'guilin-kuiguang', name: t.downloadPage.schoolName, desc: t.downloadPage.schoolDesc, status: t.downloadPage.opened },
  ];

  const mobilePlatforms: Platform[] = [
    { icon: AndroidIcon, name: 'Android', desc: '支持 Android 8.0 及以上', version: 'v1.1.0', size: '135 KB', updated: '2026-07-03', downloads: [{ label: 'apk', format: 'apk' }] },
    { icon: AppleIcon, name: 'iOS', desc: '支持 iOS 14.0 及以上', version: 'v1.1.3', size: '10 KB', updated: '2026-07-08', downloads: [{ label: 'PWA', format: 'PWA' }] },
  ];

  const desktopPlatforms: Platform[] = [
    { icon: WindowsIcon, name: 'Windows', desc: '支持 Windows 10 及以上', version: 'v1.1.2', size: '17.1 MB', updated: '26-07-06', downloads: [{ label: 'exe', format: 'exe' }] },
    { icon: MacOsIcon, name: 'macOS', desc: '支持 macOS 11 及以上', version: 'v0.0.0', size: '0 B', updated: '26-00-00', downloads: [{ label: 'dmg', format: 'dmg' }] },
    { icon: LinuxIcon, name: 'Linux', desc: '支持主流发行版', version: 'v1.1.0', size: '656 KB', updated: '26-07-06', downloads: [{ label: 'deb', format: 'deb' }, { label: 'rpm', format: 'rpm' }] },
  ];

  // 👇 提取点击处理函数
  const handleDownload = (platformName: string, format: string) => {
    const url = selectedSchool
      ? DOWNLOAD_URLS[selectedSchool]?.[platformName.toLowerCase()]?.[format]
      : undefined;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <MainLayout>
      {/* 页面头部 */}
      <section className="paper-texture py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <Badge variant="secondary" className="mb-4">{t.downloadPage.badge}</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-balance tracking-tight">{t.downloadPage.title}</h1>
          <p className="mt-4 text-muted-foreground max-w-prose mx-auto text-pretty">
            {t.downloadPage.subtitle}
          </p>
        </div>
      </section>

      {/* 第一步：选择学校 */}
      <section className="py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              <h2 className="text-xl font-bold">{t.downloadPage.selectSchoolTitle}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4 text-pretty">{t.downloadPage.selectSchoolDesc}</p>
            <div className="grid grid-cols-1 gap-4">
              {schools.map((s) => {
                const active = selectedSchool === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSchool(s.id)}
                    className={`text-left rounded-2xl border p-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                      active
                        ? 'border-primary/60 bg-white/65 shadow-hover backdrop-blur-xl'
                        : 'border-white/60 bg-white/50 shadow-card backdrop-blur-xl hover:-translate-y-0.5 hover:shadow-hover hover:bg-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={SCHOOL_LOGO}
                        alt="奎光校徽"
                        className={`w-12 h-12 rounded-xl object-contain shrink-0 transition-all ${active ? 'ring-2 ring-primary shadow-hover' : 'opacity-80'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold">{s.name}</h3>
                          <Badge variant={active ? 'default' : 'secondary'} className="text-xs">{s.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 text-pretty">{s.desc}</p>
                      </div>
                      <ChevronRight className={`h-5 w-5 shrink-0 transition-transform ${active ? 'text-primary translate-x-1' : 'text-muted-foreground'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 第二步：下载选项 */}
      <section className={`py-8 pb-16 md:pb-24 transition-all duration-500 ${selectedSchool ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="container mx-auto px-4 md:px-6">
          {selectedSchool && (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
                <h2 className="text-xl font-bold">{t.downloadPage.selectedSchool}: {schools.find((s) => s.id === selectedSchool)?.name}</h2>
              </div>
              <Tabs defaultValue="mobile" className="w-full">
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
                  <TabsTrigger value="mobile">{t.downloadPage.mobile}</TabsTrigger>
                  <TabsTrigger value="desktop">{t.downloadPage.desktop}</TabsTrigger>
                </TabsList>

                <TabsContent value="mobile">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {mobilePlatforms.map((p, i) => (
                      <motion.div
                        key={p.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Card className="h-full group">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-white/60 border border-white/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                                <p.icon className="h-8 w-8" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{p.name}</CardTitle>
                                <p className="text-xs text-muted-foreground">{p.desc}</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {p.downloads.map((d) => (
                                <Badge key={d.format} variant="outline" className="text-xs lowercase">{d.label}</Badge>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                              <div className="rounded-xl bg-white/50 border border-white/40 p-2 backdrop-blur-sm">
                                <FileText className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
                                <p className="text-[10px] text-muted-foreground">版本</p>
                                <p className="text-xs font-semibold">{p.version}</p>
                              </div>
                              <div className="rounded-xl bg-white/50 border border-white/40 p-2 backdrop-blur-sm">
                                <HardDrive className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
                                <p className="text-[10px] text-muted-foreground">大小</p>
                                <p className="text-xs font-semibold">{p.size}</p>
                              </div>
                              <div className="rounded-xl bg-white/50 border border-white/40 p-2 backdrop-blur-sm">
                                <CalendarDays className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
                                <p className="text-[10px] text-muted-foreground">更新</p>
                                <p className="text-xs font-semibold">{p.updated}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {p.downloads.map((d) => (
                                <Button
                                  key={d.format}
                                  className="flex-1"
                                  size="sm"
                                  onClick={() => handleDownload(p.name, d.format)} // 👈 修改点击事件
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  {d.label}
                                </Button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="desktop">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {desktopPlatforms.map((p, i) => (
                      <motion.div
                        key={p.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Card className="h-full group">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-white/60 border border-white/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                                <p.icon className="h-8 w-8" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{p.name}</CardTitle>
                                <p className="text-xs text-muted-foreground">{p.desc}</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {p.downloads.map((d) => (
                                <Badge key={d.format} variant="outline" className="text-xs lowercase">{d.label}</Badge>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                              <div className="rounded-xl bg-white/50 border border-white/40 p-2 backdrop-blur-sm">
                                <FileText className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
                                <p className="text-[10px] text-muted-foreground">版本</p>
                                <p className="text-xs font-semibold">{p.version}</p>
                              </div>
                              <div className="rounded-xl bg-white/50 border border-white/40 p-2 backdrop-blur-sm">
                                <HardDrive className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
                                <p className="text-[10px] text-muted-foreground">大小</p>
                                <p className="text-xs font-semibold">{p.size}</p>
                              </div>
                              <div className="rounded-xl bg-white/50 border border-white/40 p-2 backdrop-blur-sm">
                                <CalendarDays className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
                                <p className="text-[10px] text-muted-foreground">更新</p>
                                <p className="text-xs font-semibold">{p.updated}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {p.downloads.map((d) => (
                                <Button
                                  key={d.format}
                                  className="flex-1"
                                  size="sm"
                                  onClick={() => handleDownload(p.name, d.format)} // 👈 修改点击事件
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  {d.label}
                                </Button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </section>

      {/* 说明 */}
      <section className="py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/60 border border-white/50 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-semibold">{t.downloadPage.oneSchool}</h4>
              <p className="text-sm text-muted-foreground text-pretty">{t.downloadPage.oneSchoolDesc}</p>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/60 border border-white/50 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-semibold">{t.downloadPage.secure}</h4>
              <p className="text-sm text-muted-foreground text-pretty">{t.downloadPage.secureDesc}</p>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/60 border border-white/50 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-semibold">{t.downloadPage.updates}</h4>
              <p className="text-sm text-muted-foreground text-pretty">{t.downloadPage.updatesDesc}</p>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default DownloadPage;