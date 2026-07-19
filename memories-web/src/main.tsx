import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 控制台项目说明（美化版）
const c = {
  brand: "color:#fff;background:linear-gradient(90deg,#00b96b,#52c41a);font-size:24px;font-weight:bold;padding:4px 12px;border-radius:4px;",
  title: "color:#00b96b;font-size:20px;font-weight:bold;letter-spacing:1px;",
  subtitle: "color:#8c8c8c;font-size:12px;",
  label: "color:#1890ff;font-size:13px;font-weight:bold;",
  text: "color:#595959;font-size:13px;",
  link: "color:#1890ff;font-size:13px;text-decoration:underline;font-weight:500;",
  desc: "color:#262626;font-size:14px;font-weight:500;",
  divider: "color:#d9d9d9;font-size:12px;",
  footer: "color:#bfbfbf;font-size:11px;font-style:italic;",
  ascii: "color:#00b96b;font-size:11px;line-height:1.2;font-family:monospace;",
};

// ASCII Art Logo
const asciiLogo = `
%c
███╗   ███╗███████╗███╗   ███╗ ██████╗ ██████╗  ██████╗ ██╗  ██╗
████╗ ████║██╔════╝████╗ ████║██╔═══██╗██╔══██╗██╔═══██╗╚██╗██╔╝
██╔████╔██║█████╗  ██╔████╔██║██║   ██║██████╔╝██║   ██║ ╚███╔╝
██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██║   ██║██╔══██╗██║   ██║ ██╔██╗
██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║╚██████╔╝██║  ██║╚██████╔╝██╔╝ ██╗
╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
`;

console.log(
  asciiLogo,
  c.ascii,
);
console.log("%c Memories %c 校园墙回忆 · 珍藏每一刻美好", c.brand, c.subtitle);
console.log("%c─────────────────────────────────────────────", c.divider);
console.log("%c项目介绍%c %cMemories 是一个面向校园社区的图片上传与审核系统，致力于为校园墙提供便捷、安全、可追溯的内容管理体验。", c.label, "", c.desc);
console.log("%c─────────────────────────────────────────────", c.divider);
console.log("%c官网%c    %chttps://memories.mrcwoods.com", c.label, "", c.link);
console.log("%c校园墙%c  %chttps://gz.campux.top", c.label, "", c.link);
console.log("%c开源%c    %chttps://github.com/MrWoods1692/Memories", c.label, "", c.link);
console.log("%c─────────────────────────────────────────────", c.divider);
console.log("%c© 2026 MrWoods1692 · Licensed under the MIT License", c.footer);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
