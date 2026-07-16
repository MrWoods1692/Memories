import HomePage from './pages/HomePage';
import FeaturesPage from './pages/FeaturesPage';
import DownloadPage from './pages/DownloadPage';
import AboutPage from './pages/AboutPage';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: '首页',
    path: '/',
    element: <HomePage />,
    public: true,
  },
  {
    name: '功能介绍',
    path: '/features',
    element: <FeaturesPage />,
    public: true,
  },
  {
    name: '客户端下载',
    path: '/download',
    element: <DownloadPage />,
    public: true,
  },
  {
    name: '关于',
    path: '/about',
    element: <AboutPage />,
    public: true,
  },
];
