export type Language = 'zh' | 'en' | 'zh-TW' | 'ja';

export const languages: { code: Language; label: string; short: string }[] = [
  { code: 'zh', label: '简体中文', short: '简' },
  { code: 'zh-TW', label: '繁體中文', short: '繁' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ja', label: '日本語', short: '日' },
];

export interface Translation {
  nav: { home: string; features: string; download: string; about: string; downloadBtn: string };
  hero: {
    badge: string; title1: string; title2: string; desc: string; cta1: string; cta2: string;
    stats: { label: string; value: string }[];
  };
  featuresOverview: { title: string; subtitle: string; viewAll: string; items: { title: string; desc: string }[] };
  platforms: { title: string; subtitle: string; downloadCta: string };
  school: { title: string; desc: string; name: string; status: string };
  featuresPage: {
    badge: string; title: string; subtitle: string;
    browseTitle: string; browseSubtitle: string; actionsTitle: string; infoTitle: string;
    uploadTitle: string; uploadSubtitle: string; batchTitle: string; batchSubtitle: string;
    settingsTitle: string; settingsSubtitle: string; themeTitle: string; fontTitle: string; fontSizeTitle: string;
    lightMode: string; darkMode: string;
    infoDesc: Record<string, string>;
  };
  downloadPage: {
    badge: string; title: string; subtitle: string;
    selectSchoolTitle: string; selectSchoolDesc: string; selectedSchool: string; schoolName: string; schoolDesc: string; opened: string;
    mobile: string; desktop: string; downloadVersion: string; oneSchool: string; oneSchoolDesc: string;
    secure: string; secureDesc: string; updates: string; updatesDesc: string;
  };
  aboutPage: {
    badge: string; title: string; subtitle: string; missionTitle: string; missionText: string;
    valuesTitle: string; values: { title: string; desc: string }[];
    schoolTitle: string; schoolText: string; schoolStatus: string;
    openSourceTitle: string; openSourceDesc: string; repo: string; license: string; viewRepo: string;
    developerTitle: string; developerName: string; developerHome: string; developerHomeLabel: string;
    timelineTitle: string; launchDate: string; launchDateLabel: string; uptimeLabel: string; uptimeSuffix: string;
    ctaTitle: string; ctaText: string; ctaBtn: string;
  };
  footer: { desc: string; product: string; about: string; copyright: string };
}

const zh: Translation = {
  nav: { home: '首页', features: '功能介绍', download: '客户端下载', about: '关于', downloadBtn: '立即下载' },
  hero: {
    badge: '校园记忆分享平台',
    title1: '珍藏校园里的',
    title2: '每一个美好瞬间',
    desc: 'Memories 为学生打造专属的记忆分享空间，上传、浏览、管理校园照片，让青春的每一帧都被温柔记录。',
    cta1: '立即下载客户端', cta2: '了解功能',
    stats: [
      { label: '全平台覆盖', value: '5+' },
      { label: '照片操作', value: '12' },
      { label: '主题配色', value: '5' },
    ],
  },
  featuresOverview: {
    title: '强大的功能体验', subtitle: '从浏览到上传，从分享到管理，一切尽在掌握', viewAll: '查看全部功能',
    items: [
      { title: '照片浏览', desc: '查看全校上传的照片，支持旋转、翻转、放大缩小、拖拽等多种操作' },
      { title: '批量上传', desc: '支持单张和批量上传，实时查看上传队列，完成自动通知' },
      { title: '分享互动', desc: '一键分享、下载、复制链接，让美好记忆传递给更多人' },
      { title: '个性主题', desc: '5种主题配色、亮暗模式切换、8种字体、5档字号自由调节' },
      { title: '智能管理', desc: '设置下载位置、清理本地缓存、AI标签与描述智能识别' },
      { title: '多端下载', desc: '支持 Android、iOS、Windows、macOS、Linux 全平台客户端' },
    ],
  },
  platforms: { title: '全平台客户端', subtitle: '无论你使用什么设备，都能随时记录校园记忆', downloadCta: '选择你的平台下载' },
  school: { title: '一校一包，专属定制', desc: '每所学校拥有独立的客户端，数据隔离、安全可靠。', name: '桂林市奎光学校', status: '已开通 Memories 服务' },
  featuresPage: {
    badge: '功能介绍', title: '全方位的校园记忆管理体验', subtitle: '从照片浏览到上传管理，从个性化设置到智能识别，Memories 提供完整的功能体系',
    browseTitle: '照片浏览与操作', browseSubtitle: '丰富的操作工具，让每一张照片都能完美呈现',
    actionsTitle: '操作工具', infoTitle: '信息查询',
    uploadTitle: '照片上传管理', uploadSubtitle: '便捷的上传体验，让分享变得简单',
    batchTitle: '批量操作', batchSubtitle: '高效管理多张照片，一键完成批量处理',
    settingsTitle: '个性化设置', settingsSubtitle: '打造专属于你的使用体验',
    themeTitle: '主题选择', fontTitle: '字体选择', fontSizeTitle: '字号调整',
    lightMode: '亮色模式', darkMode: '暗色模式',
    infoDesc: {
      '图片名称': '查看图片原始文件名', '储存位置': '查看图片存储路径信息',
      'AI标签': '智能识别图片内容标签', 'AI描述': '自动生成图片描述文字',
    },
  },
  downloadPage: {
    badge: '客户端下载', title: '下载 Memories 客户端', subtitle: '先选择你的学校，再下载对应学校的专属客户端',
    selectSchoolTitle: '第一步：选择学校', selectSchoolDesc: '每所学校拥有独立的客户端，请先选择你的学校',
    selectedSchool: '已选择学校', schoolName: '桂林市奎光学校', schoolDesc: '当前已开通 Memories 专属服务，以下客户端均为该校定制版本', opened: '已开通',
    mobile: '移动端', desktop: '电脑端', downloadVersion: '下载版本',
    oneSchool: '一校一包', oneSchoolDesc: '每所学校拥有独立的客户端包，数据完全隔离',
    secure: '安全可靠', secureDesc: '采用 OAuth + PKCE 安全授权，保护账号安全',
    updates: '持续更新', updatesDesc: '定期推送功能更新与安全补丁',
  },
  aboutPage: {
    badge: '关于 Memories', title: '为校园记忆而生', subtitle: 'Memories 致力于为学校学生打造一个温暖、安全、智能的记忆分享平台，让青春的每一帧都被珍藏。',
    missionTitle: '我们的使命', missionText: '校园时光是人生中最珍贵的记忆之一。我们相信，每一张照片都承载着独特的故事与情感。Memories 希望成为这些美好瞬间的守护者，让同学们能够轻松上传、浏览、分享校园生活中的点点滴滴，让记忆不再随时间流逝而褪色。',
    valuesTitle: '核心价值',
    values: [
      { title: '珍藏记忆', desc: '让校园里的每一个美好瞬间都被温柔记录与珍藏' },
      { title: '连接彼此', desc: '通过照片分享，连接同学之间的情感纽带' },
      { title: '安全守护', desc: '采用业界领先的安全技术，守护每一份隐私' },
      { title: '智能体验', desc: 'AI赋能的照片管理，让浏览与查找更高效' },
    ],
    schoolTitle: '学校合作', schoolText: 'Memories 采用「一校一包」模式，为每所学校提供独立的客户端与数据空间。', schoolStatus: '首家合作学校 · 已开通服务',
    openSourceTitle: '开源项目', openSourceDesc: 'Memories 客户端是一个开源项目，代码托管在 GitHub，欢迎开发者参与贡献与改进。',
    repo: 'idoknow/Memories-Client', license: 'GPL-3.0 License', viewRepo: '查看 GitHub 仓库',
    developerTitle: '开发者', developerName: 'Mr.C.Woods', developerHome: 'mrcwoods.com', developerHomeLabel: '访问开发者主页',
    timelineTitle: '项目时间线', launchDateLabel: '项目上架时间', launchDate: '2026年7月4日', uptimeLabel: '稳定运行时间', uptimeSuffix: '',
    ctaTitle: '开始记录你的校园记忆', ctaText: '下载 Memories 客户端，即刻开启你的记忆之旅', ctaBtn: '下载客户端',
  },
  footer: { desc: 'Memories 是为学校学生打造的记忆分享平台，让校园里的每一个美好瞬间都被珍藏与分享。', product: '产品', about: '关于', copyright: 'Memories · 保留所有权利' },
};

const en: Translation = {
  nav: { home: 'Home', features: 'Features', download: 'Download', about: 'About', downloadBtn: 'Download' },
  hero: {
    badge: 'Campus Memory Sharing Platform',
    title1: 'Cherish Every',
    title2: 'Beautiful Campus Moment',
    desc: 'Memories creates a dedicated memory-sharing space for students. Upload, browse, and manage campus photos — every frame of youth, gently preserved.',
    cta1: 'Download Client', cta2: 'Explore Features',
    stats: [
      { label: 'Platforms', value: '5+' },
      { label: 'Photo Tools', value: '12' },
      { label: 'Themes', value: '5' },
    ],
  },
  featuresOverview: {
    title: 'Powerful Feature Experience', subtitle: 'From browsing to uploading, from sharing to managing — everything at your fingertips', viewAll: 'View All Features',
    items: [
      { title: 'Photo Browsing', desc: 'Browse photos uploaded by the whole school with rotate, flip, zoom, drag and more' },
      { title: 'Batch Upload', desc: 'Support single and batch uploads with real-time queue and auto notifications' },
      { title: 'Sharing', desc: 'One-click share, download, copy link — share beautiful memories with more people' },
      { title: 'Personalization', desc: '5 theme colors, light/dark mode, 8 fonts, 5 font sizes — fully customizable' },
      { title: 'Smart Management', desc: 'Set download location, clear cache, AI tags and descriptions for smart recognition' },
      { title: 'Multi-Platform', desc: 'Available on Android, iOS, Windows, macOS, and Linux' },
    ],
  },
  platforms: { title: 'Cross-Platform Client', subtitle: 'No matter what device you use, capture campus memories anytime', downloadCta: 'Choose Your Platform' },
  school: { title: 'One School, One Package', desc: 'Each school has its own independent client with isolated data.', name: 'Guilin Kuiguang School', status: 'Memories Service Activated' },
  featuresPage: {
    badge: 'Features', title: 'Comprehensive Campus Memory Management', subtitle: 'From photo browsing to upload management, from personalization to smart recognition — Memories provides a complete feature set',
    browseTitle: 'Photo Browsing & Operations', browseSubtitle: 'Rich tools to present every photo perfectly',
    actionsTitle: 'Action Tools', infoTitle: 'Information Query',
    uploadTitle: 'Photo Upload Management', uploadSubtitle: 'Effortless uploading experience',
    batchTitle: 'Batch Operations', batchSubtitle: 'Efficiently manage multiple photos with one-click batch processing',
    settingsTitle: 'Personalization', settingsSubtitle: 'Create your own unique experience',
    themeTitle: 'Theme Selection', fontTitle: 'Font Selection', fontSizeTitle: 'Font Size',
    lightMode: 'Light Mode', darkMode: 'Dark Mode',
    infoDesc: {
      '图片名称': 'View original file name', '储存位置': 'View storage path info',
      'AI标签': 'Smart content tag recognition', 'AI描述': 'Auto-generated image description',
    },
  },
  downloadPage: {
    badge: 'Client Download', title: 'Download Memories Client', subtitle: 'Select your school first, then download the dedicated client for that school',
    selectSchoolTitle: 'Step 1: Select School', selectSchoolDesc: 'Each school has its own client. Please select your school first.',
    selectedSchool: 'Selected School', schoolName: 'Guilin Kuiguang School', schoolDesc: 'Memories exclusive service is active. All clients below are customized for this school.', opened: 'Active',
    mobile: 'Mobile', desktop: 'Desktop', downloadVersion: 'Download',
    oneSchool: 'One School, One Package', oneSchoolDesc: 'Each school has its own independent client package with fully isolated data',
    secure: 'Secure & Reliable', secureDesc: 'OAuth + PKCE secure authorization protects your account',
    updates: 'Continuous Updates', updatesDesc: 'Regular feature updates and security patches',
  },
  aboutPage: {
    badge: 'About Memories', title: 'Built for Campus Memories', subtitle: 'Memories is dedicated to creating a warm, secure, and intelligent memory-sharing platform for students.',
    missionTitle: 'Our Mission', missionText: 'Campus life holds some of the most precious memories. We believe every photo carries a unique story and emotion. Memories aims to be the guardian of these beautiful moments, allowing students to easily upload, browse, and share campus life — so memories never fade with time.',
    valuesTitle: 'Core Values',
    values: [
      { title: 'Cherish Memories', desc: 'Every beautiful campus moment, gently recorded and treasured' },
      { title: 'Connect People', desc: 'Connect classmates through shared photos and emotional bonds' },
      { title: 'Security First', desc: 'Industry-leading security technology to protect every piece of privacy' },
      { title: 'Smart Experience', desc: 'AI-powered photo management for more efficient browsing and search' },
    ],
    schoolTitle: 'School Partnership', schoolText: 'Memories uses a "one school, one package" model, providing each school with an independent client and data space.', schoolStatus: 'First Partner School · Active',
    openSourceTitle: 'Open Source Project', openSourceDesc: 'The Memories client is an open-source project hosted on GitHub. Developers are welcome to contribute and improve.',
    repo: 'idoknow/Memories-Client', license: 'GPL-3.0 License', viewRepo: 'View GitHub Repository',
    developerTitle: 'Developer', developerName: 'Mr.C.Woods', developerHome: 'mrcwoods.com', developerHomeLabel: 'Visit Developer Homepage',
    timelineTitle: 'Project Timeline', launchDateLabel: 'Launch Date', launchDate: 'July 4, 2026', uptimeLabel: 'Stable Uptime', uptimeSuffix: '',
    ctaTitle: 'Start Recording Your Campus Memories', ctaText: 'Download the Memories client and begin your memory journey today', ctaBtn: 'Download Client',
  },
  footer: { desc: 'Memories is a memory-sharing platform for students, preserving every beautiful campus moment.', product: 'Product', about: 'About', copyright: 'Memories · All Rights Reserved' },
};

const zhTW: Translation = {
  nav: { home: '首頁', features: '功能介紹', download: '客戶端下載', about: '關於', downloadBtn: '立即下載' },
  hero: {
    badge: '校園記憶分享平台',
    title1: '珍藏校園裡的',
    title2: '每一個美好瞬間',
    desc: 'Memories 為學生打造專屬的記憶分享空間，上傳、瀏覽、管理校園照片，讓青春的每一幀都被溫柔記錄。',
    cta1: '立即下載客戶端', cta2: '了解功能',
    stats: [
      { label: '全平台覆蓋', value: '5+' },
      { label: '照片操作', value: '12' },
      { label: '主題配色', value: '5' },
    ],
  },
  featuresOverview: {
    title: '強大的功能體驗', subtitle: '從瀏覽到上傳，從分享到管理，一切盡在掌握', viewAll: '查看全部功能',
    items: [
      { title: '照片瀏覽', desc: '查看全校上傳的照片，支援旋轉、翻轉、放大縮小、拖曳等多種操作' },
      { title: '批次上傳', desc: '支援單張和批次上傳，即時查看上傳佇列，完成自動通知' },
      { title: '分享互動', desc: '一鍵分享、下載、複製連結，讓美好記憶傳遞給更多人' },
      { title: '個性主題', desc: '5種主題配色、亮暗模式切換、8種字體、5檔字號自由調節' },
      { title: '智慧管理', desc: '設定下載位置、清理本地快取、AI標籤與描述智慧識別' },
      { title: '多端下載', desc: '支援 Android、iOS、Windows、macOS、Linux 全平台客戶端' },
    ],
  },
  platforms: { title: '全平台客戶端', subtitle: '無論你使用什麼裝置，都能隨時記錄校園記憶', downloadCta: '選擇你的平台下載' },
  school: { title: '一校一包，專屬定制', desc: '每所學校擁有獨立的客戶端，資料隔離、安全可靠。', name: '桂林市奎光學校', status: '已開通 Memories 服務' },
  featuresPage: {
    badge: '功能介紹', title: '全方位的校園記憶管理體驗', subtitle: '從照片瀏覽到上傳管理，從個性化設定到智慧識別，Memories 提供完整的功能體系',
    browseTitle: '照片瀏覽與操作', browseSubtitle: '豐富的操作工具，讓每一張照片都能完美呈現',
    actionsTitle: '操作工具', infoTitle: '資訊查詢',
    uploadTitle: '照片上傳管理', uploadSubtitle: '便捷的上傳體驗，讓分享變得簡單',
    batchTitle: '批次操作', batchSubtitle: '高效管理多張照片，一鍵完成批次處理',
    settingsTitle: '個性化設定', settingsSubtitle: '打造專屬於你的使用體驗',
    themeTitle: '主題選擇', fontTitle: '字體選擇', fontSizeTitle: '字號調整',
    lightMode: '亮色模式', darkMode: '暗色模式',
    infoDesc: {
      '图片名称': '查看圖片原始檔名', '储存位置': '查看圖片儲存路徑資訊',
      'AI标签': '智慧識別圖片內容標籤', 'AI描述': '自動生成圖片描述文字',
    },
  },
  downloadPage: {
    badge: '客戶端下載', title: '下載 Memories 客戶端', subtitle: '先選擇你的學校，再下載對應學校的專屬客戶端',
    selectSchoolTitle: '第一步：選擇學校', selectSchoolDesc: '每所學校擁有獨立的客戶端，請先選擇你的學校',
    selectedSchool: '已選擇學校', schoolName: '桂林市奎光學校', schoolDesc: '當前已開通 Memories 專屬服務，以下客戶端均為該校定制版本', opened: '已開通',
    mobile: '行動端', desktop: '桌面端', downloadVersion: '下載版本',
    oneSchool: '一校一包', oneSchoolDesc: '每所學校擁有獨立的客戶端包，資料完全隔離',
    secure: '安全可靠', secureDesc: '採用 OAuth + PKCE 安全授權，保護帳號安全',
    updates: '持續更新', updatesDesc: '定期推送功能更新與安全修補',
  },
  aboutPage: {
    badge: '關於 Memories', title: '為校園記憶而生', subtitle: 'Memories 致力於為學校學生打造一個溫暖、安全、智慧的記憶分享平台。',
    missionTitle: '我們的使命', missionText: '校園時光是人生中最珍貴的記憶之一。我們相信，每一張照片都承載著獨特的故事與情感。Memories 希望成為這些美好瞬間的守護者，讓同學們能夠輕鬆上傳、瀏覽、分享校園生活中的點點滴滴，讓記憶不再隨時間流逝而褪色。',
    valuesTitle: '核心價值',
    values: [
      { title: '珍藏記憶', desc: '讓校園裡的每一個美好瞬間都被溫柔記錄與珍藏' },
      { title: '連結彼此', desc: '透過照片分享，連結同學之間的情感紐帶' },
      { title: '安全守護', desc: '採用業界領先的安全技術，守護每一份隱私' },
      { title: '智慧體驗', desc: 'AI賦能的照片管理，讓瀏覽與查找更高效' },
    ],
    schoolTitle: '學校合作', schoolText: 'Memories 採用「一校一包」模式，為每所學校提供獨立的客戶端與資料空間。', schoolStatus: '首家合作學校 · 已開通',
    openSourceTitle: '開源專案', openSourceDesc: 'Memories 客戶端是一個開源專案，程式碼託管在 GitHub，歡迎開發者參與貢獻與改進。',
    repo: 'idoknow/Memories-Client', license: 'GPL-3.0 License', viewRepo: '查看 GitHub 倉庫',
    developerTitle: '開發者', developerName: 'Mr.C.Woods', developerHome: 'mrcwoods.com', developerHomeLabel: '造訪開發者主頁',
    timelineTitle: '專案時間線', launchDateLabel: '專案上架時間', launchDate: '2026年7月4日', uptimeLabel: '穩定運行時間', uptimeSuffix: '',
    ctaTitle: '開始記錄你的校園記憶', ctaText: '下載 Memories 客戶端，即刻開啟你的記憶之旅', ctaBtn: '下載客戶端',
  },
  footer: { desc: 'Memories 是為學校學生打造的記憶分享平台，讓校園裡的每一個美好瞬間都被珍藏與分享。', product: '產品', about: '關於', copyright: 'Memories · 保留所有權利' },
};

const ja: Translation = {
  nav: { home: 'ホーム', features: '機能紹介', download: 'ダウンロード', about: '概要', downloadBtn: '今すぐダウンロード' },
  hero: {
    badge: 'キャンパスメモリー共有プラットフォーム',
    title1: 'キャンパスの',
    title2: 'すべての美しい瞬間を大切に',
    desc: 'Memories は学生のための思い出共有スペースです。写真のアップロード、閲覧、管理を通じて、青春のワンシーンを優しく記録します。',
    cta1: 'クライアントをダウンロード', cta2: '機能を見る',
    stats: [
      { label: '対応プラットフォーム', value: '5+' },
      { label: '写真操作', value: '12' },
      { label: 'テーマ配色', value: '5' },
    ],
  },
  featuresOverview: {
    title: '強力な機能体験', subtitle: '閲覧からアップロード、共有から管理まで、すべてが手の届くところに', viewAll: 'すべての機能を見る',
    items: [
      { title: '写真閲覧', desc: '全校の写真を閲覧、回転・反転・拡大縮小・ドラッグなど多彩な操作に対応' },
      { title: '一括アップロード', desc: '単体・一括アップロードに対応、リアルタイムキューと完了通知' },
      { title: 'シェア機能', desc: 'ワンクリックでシェア、ダウンロード、リンクコピーが可能' },
      { title: 'パーソナライズ', desc: '5種類のテーマ、ライト/ダークモード、8種類のフォント、5段階のサイズ調整' },
      { title: 'スマート管理', desc: 'ダウンロード先の設定、キャッシュクリア、AIタグと説明の自動認識' },
      { title: 'マルチプラットフォーム', desc: 'Android、iOS、Windows、macOS、Linux に対応' },
    ],
  },
  platforms: { title: '全プラットフォーム対応', subtitle: 'どんなデバイスでも、いつでもキャンパスの思い出を記録', downloadCta: 'プラットフォームを選択' },
  school: { title: '一校一パッケージ、専用カスタマイズ', desc: '各学校が独立したクライアントを持ち、データは完全に分離されています。', name: '桂林市奎光学校', status: 'Memories サービス提供中' },
  featuresPage: {
    badge: '機能紹介', title: '包括的なキャンパスメモリー管理', subtitle: '写真閲覧からアップロード管理、パーソナライズからスマート認識まで、Memories は完全な機能体系を提供します',
    browseTitle: '写真の閲覧と操作', browseSubtitle: '豊富な操作ツールで、すべての写真を完璧に表示',
    actionsTitle: '操作ツール', infoTitle: '情報照会',
    uploadTitle: '写真アップロード管理', uploadSubtitle: '簡単で便利なアップロード体験',
    batchTitle: '一括操作', batchSubtitle: '複数の写真を効率的に管理、ワンクリックで一括処理',
    settingsTitle: 'パーソナライズ設定', settingsSubtitle: 'あなただけの体験を作りましょう',
    themeTitle: 'テーマ選択', fontTitle: 'フォント選択', fontSizeTitle: 'フォントサイズ',
    lightMode: 'ライトモード', darkMode: 'ダークモード',
    infoDesc: {
      '图片名称': '元のファイル名を表示', '储存位置': '保存場所の情報を表示',
      'AI标签': 'AIによるコンテンツタグ認識', 'AI描述': 'AIによる自動画像説明',
    },
  },
  downloadPage: {
    badge: 'クライアントダウンロード', title: 'Memories クライアントをダウンロード', subtitle: 'まず学校を選択し、その学校専用のクライアントをダウンロードしてください',
    selectSchoolTitle: 'ステップ1：学校を選択', selectSchoolDesc: '各学校には独立したクライアントがあります。まず学校を選択してください。',
    selectedSchool: '選択済みの学校', schoolName: '桂林市奎光学校', schoolDesc: 'Memories 専用サービスが有効です。以下のクライアントはすべて同校向けのカスタム版です。', opened: '提供中',
    mobile: 'モバイル', desktop: 'デスクトップ', downloadVersion: 'ダウンロード',
    oneSchool: '一校一パッケージ', oneSchoolDesc: '各学校が独立したクライアントパッケージを持ち、データは完全に分離',
    secure: '安全・信頼性', secureDesc: 'OAuth + PKCE の安全な認証でアカウントを保護',
    updates: '継続的なアップデート', updatesDesc: '定期的な機能追加とセキュリティパッチを提供',
  },
  aboutPage: {
    badge: 'Memories について', title: 'キャンパスの思い出のために', subtitle: 'Memories は、学生のための温かく、安全で、スマートな思い出共有プラットフォームを目指しています。',
    missionTitle: '私たちのミッション', missionText: 'キャンパスライフは人生で最も貴重な思い出の一つです。私たちは、すべての写真が独自の物語と感情を宿していると信じています。Memories は、これらの美しい瞬間の守護者として、学生がキャンパスライフを簡単にアップロード、閲覧、共有できるようにしたいと考えています。',
    valuesTitle: 'コアバリュー',
    values: [
      { title: '思い出を大切に', desc: 'キャンパスのすべての美しい瞬間を優しく記録し、大切に保存' },
      { title: '人と人を繋ぐ', desc: '写真の共有を通じて、クラスメイト同士の絆を深める' },
      { title: '安全第一', desc: '業界をリードするセキュリティ技術で、すべてのプライバシーを保護' },
      { title: 'スマート体験', desc: 'AIを活用した写真管理で、より効率的な閲覧と検索を実現' },
    ],
    schoolTitle: '学校パートナーシップ', schoolText: 'Memories は「一校一パッケージ」モデルを採用し、各学校に独立したクライアントとデータ空間を提供します。', schoolStatus: '最初の提携校 · 提供中',
    openSourceTitle: 'オープンソースプロジェクト', openSourceDesc: 'Memories クライアントはオープンソースプロジェクトで、コードは GitHub で公開されています。開発者の皆様の貢献と改善を歓迎します。',
    repo: 'idoknow/Memories-Client', license: 'GPL-3.0 License', viewRepo: 'GitHub リポジトリを見る',
    developerTitle: '開発者', developerName: 'Mr.C.Woods', developerHome: 'mrcwoods.com', developerHomeLabel: '開発者ホームページを開く',
    timelineTitle: 'プロジェクトタイムライン', launchDateLabel: 'プロジェクト公開日', launchDate: '2026年7月4日', uptimeLabel: '安定稼働時間', uptimeSuffix: '',
    ctaTitle: 'キャンパスの思い出を記録し始めましょう', ctaText: 'Memories クライアントをダウンロードして、思い出の旅を今すぐ始めましょう', ctaBtn: 'クライアントをダウンロード',
  },
  footer: { desc: 'Memories は学生のための思い出共有プラットフォームです。キャンパスのすべての美しい瞬間を大切に保存します。', product: '製品', about: '概要', copyright: 'Memories · All Rights Reserved' },
};

export const translations: Record<Language, Translation> = { zh, en, 'zh-TW': zhTW, ja };