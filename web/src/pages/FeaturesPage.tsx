import React from 'react';
import { motion } from 'motion/react';
import {
  RotateCw, FlipVertical, FlipHorizontal, Share2, Download,
  Link2, ZoomIn, ZoomOut, Image, RotateCcw, Printer, Move,
  Tag, MapPin, Sparkles, FileText, Upload, ListChecks,
  Bell, Trash2, FolderDown, Database, Palette, Sun, Moon,
  Type, TextCursorInput, CheckSquare, Copy, Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MainLayout from '@/components/layouts/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';

const FeaturesPage: React.FC = () => {
  const { t } = useLanguage();

  const photoActions = [
    { icon: RotateCw, label: '旋转' },
    { icon: FlipVertical, label: '上下翻转' },
    { icon: FlipHorizontal, label: '左右翻转' },
    { icon: Share2, label: '分享' },
    { icon: Download, label: '下载' },
    { icon: Link2, label: '复制图片URL' },
    { icon: ZoomIn, label: '放大' },
    { icon: ZoomOut, label: '缩小' },
    { icon: Image, label: '设置壁纸' },
    { icon: RotateCcw, label: '还原' },
    { icon: Printer, label: '打印' },
    { icon: Move, label: '拖拽' },
  ];

  const photoInfo = [
    { icon: FileText, label: '图片名称' },
    { icon: MapPin, label: '储存位置' },
    { icon: Tag, label: 'AI标签' },
    { icon: Sparkles, label: 'AI描述' },
  ];

  const uploadFeatures = [
    { icon: Upload, label: '单张上传' },
    { icon: Upload, label: '批量上传' },
    { icon: ListChecks, label: '上传队列' },
    { icon: Bell, label: '完成通知' },
    { icon: Trash2, label: '清除记录' },
  ];

  const batchFeatures = [
    { icon: CheckSquare, label: '全选' },
    { icon: Share2, label: '批量分享' },
    { icon: Download, label: '批量下载' },
    { icon: Printer, label: '批量打印' },
    { icon: Copy, label: '批量复制' },
  ];

  const settingsFeatures = [
    { icon: FolderDown, label: '设置下载位置' },
    { icon: Database, label: '清理本地缓存' },
  ];

  const themes = [
    { name: '简约黑白', colors: ['#1A1A1A', '#FFFFFF', '#666666'] },
    { name: '苔光晨雾', colors: ['#1D6E5A', '#53C49E', '#EDE9E0'] },
    { name: '霞橙晴空', colors: ['#E76F51', '#F4A261', '#E9C46A'] },
    { name: '青蓝玻璃', colors: ['#2A9D8F', '#264653', '#A8DADC'] },
    { name: '夜航霓光', colors: ['#6A0572', '#AB83A1', '#F15BB5'] },
  ];

  const fontSizes = ['极小', '小', '正常', '大', '极大'];

  return (
    <MainLayout>
      {/* 页面头部 */}
      <section className="paper-texture py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <Badge variant="secondary" className="mb-4">{t.featuresPage.badge}</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-balance">{t.featuresPage.title}</h1>
          <p className="mt-4 text-muted-foreground max-w-prose mx-auto text-pretty">
            {t.featuresPage.subtitle}
          </p>
        </div>
      </section>

      {/* 照片浏览操作 */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.featuresPage.browseTitle}</h2>
            <p className="mt-3 text-muted-foreground text-pretty">{t.featuresPage.browseSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 操作工具 */}
            <Card className="">
              <CardHeader>
                <CardTitle className="text-lg">{t.featuresPage.actionsTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {photoActions.map((a, i) => (
                    <motion.div
                      key={a.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.04 }}
                      className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/50 border border-white/40 backdrop-blur-sm hover:bg-white/70 hover:text-primary transition-all duration-200 group"
                    >
                      <a.icon className="h-5 w-5 text-primary" />
                      <span className="text-xs text-center">{a.label}</span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 信息查询 */}
            <Card className="">
              <CardHeader>
                <CardTitle className="text-lg">{t.featuresPage.infoTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {photoInfo.map((info) => (
                    <div key={info.label} className="flex items-center gap-3 p-3 rounded-2xl bg-white/50 border border-white/40 backdrop-blur-sm hover:bg-white/60 transition-all duration-200">
                      <div className="w-9 h-9 rounded-2xl bg-white/60 border border-white/50 flex items-center justify-center shrink-0">
                        <info.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{info.label}</p>
                        <p className="text-xs text-muted-foreground">{t.featuresPage.infoDesc[info.label]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 上传功能 */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.featuresPage.uploadTitle}</h2>
            <p className="mt-3 text-muted-foreground text-pretty">{t.featuresPage.uploadSubtitle}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {uploadFeatures.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="w-40 text-center ">
                  <CardContent className="p-5 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/60 border border-white/50 flex items-center justify-center">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{f.label}</span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 批量操作 */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-2">
              <Layers className="h-6 w-6 text-primary" />
              <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.featuresPage.batchTitle}</h2>
            </div>
            <p className="mt-3 text-muted-foreground text-pretty">{t.featuresPage.batchSubtitle}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {batchFeatures.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="w-40 text-center  border-primary/20">
                  <CardContent className="p-5 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                      <f.icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-sm font-medium">{f.label}</span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 设置功能 */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-balance">{t.featuresPage.settingsTitle}</h2>
            <p className="mt-3 text-muted-foreground text-pretty">{t.featuresPage.settingsSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 基础设置 */}
            <Card className="">
              <CardHeader>
                <CardTitle className="text-lg">基础设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {settingsFeatures.map((s) => (
                  <div key={s.label} className="flex items-center gap-3 p-3 rounded-2xl bg-white/50 border border-white/40 backdrop-blur-sm hover:bg-white/60 transition-all duration-200">
                    <div className="w-9 h-9 rounded-2xl bg-white/60 border border-white/50 flex items-center justify-center shrink-0">
                      <s.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{s.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 主题选择 */}
            <Card className="">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  {t.featuresPage.themeTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {themes.map((th) => (
                    <div key={th.name} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/60 transition-all duration-200">
                      <div className="flex gap-1">
                        {th.colors.map((c, ci) => (
                          <div key={ci} className="w-6 h-6 rounded-full border border-white/40" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <span className="text-sm">{th.name}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-4 pt-2 border-t border-white/40">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-accent" />
                      <span className="text-sm">{t.featuresPage.lightMode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-primary" />
                      <span className="text-sm">{t.featuresPage.darkMode}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 字体与字号 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <Card className="">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Type className="h-5 w-5 text-primary" />
                  {t.featuresPage.fontTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {['思源宋体', '思源黑体', '楷体', '仿宋', '圆体', '手写体', '隶书', '黑体'].map((font) => (
                    <div key={font} className="px-3 py-2 rounded-2xl bg-white/50 border border-white/40 backdrop-blur-sm text-sm text-center hover:bg-white/70 hover:text-primary transition-all duration-200">
                      {font}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TextCursorInput className="h-5 w-5 text-primary" />
                  {t.featuresPage.fontSizeTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2">
                  {fontSizes.map((size, i) => (
                    <div key={size} className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-full bg-white/60 border border-white/50 flex items-center justify-center">
                        <span className="text-primary font-bold" style={{ fontSize: `${10 + i * 3}px` }}>A</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{size}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default FeaturesPage;