import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MainLayout from '@/components/layouts/MainLayout';

const LoginPage: React.FC = () => {
  return (
    <MainLayout>
      <section className="paper-texture min-h-[80vh] flex items-center justify-center py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-md mx-auto">
            <Button variant="ghost" size="sm" asChild className="mb-6">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回首页
              </Link>
            </Button>

            <Card className="shadow-card">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-white/60 border border-white/50 flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">校园墙账号登录</CardTitle>
                <p className="text-sm text-muted-foreground mt-2 text-pretty">
                  使用校园墙账号授权登录 Memories
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* OAuth 授权按钮 */}
                <Button className="w-full" size="lg" onClick={() => {}}>
                  <KeyRound className="mr-2 h-5 w-5" />
                  使用校园墙账号登录
                </Button>

                {/* 安全说明 */}
                <div className="space-y-3 pt-4 border-t border-white/40">
                  <div className="flex items-start gap-3">
                    <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">OAuth 2.0 安全授权</p>
                      <p className="text-xs text-muted-foreground">通过标准 OAuth 协议进行身份验证</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">PKCE 安全机制</p>
                      <p className="text-xs text-muted-foreground">采用 PKCE 增强授权安全性</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">数据隔离保护</p>
                      <p className="text-xs text-muted-foreground">学校间数据完全隔离，保障隐私</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  登录即表示同意《用户协议》和《隐私政策》
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default LoginPage;