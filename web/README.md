# Memories Web

Memories 的 Web 前台项目，基于 React 18、Vite、Tailwind CSS 和 shadcn/ui 构建。

## 开发

```bash
pnpm install
pnpm dev
```

开发服务器默认由 Vite 分配本地端口。生产构建输出到 `dist/`，该目录是生成产物，不需要提交。

## 构建与检查

```bash
pnpm build
pnpm lint
```

`pnpm lint` 会运行 TypeScript、Biome、规则脚本和 Tailwind CSS 检查。首次运行前请确保已安装项目依赖。

## 目录说明

```text
src/
├── brand/       # 品牌素材与主题相关内容
├── common/      # 通用能力
├── components/  # 页面组件与基础 UI
├── contexts/    # React Context
├── hooks/       # 自定义 Hook
├── lib/         # 工具函数和客户端封装
├── pages/       # 路由页面
└── types/       # 类型定义
```
