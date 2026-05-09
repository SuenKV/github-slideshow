# Video Cache Downloader - 视频缓存下载器

一个功能强大的浏览器扩展，用于检测、下载和转换网页视频。

## 功能特性

- 🎬 **自动检测** - 智能扫描网页中的视频资源
- 📥 **直接下载** - 支持下载单个或批量视频
- 🔄 **格式转换** - 使用 FFmpeg WASM 转换视频格式 (MP4/WebM)
- 📦 **批量打包** - 将多个视频打包为 ZIP 文件下载
- ⏳ **进度追踪** - 实时显示下载和转换进度
- 🎨 **简洁界面** - 现代化设计，操作直观

## 技术架构

```
┌──────────────────────────────────────┐
│         Popup UI (用户界面)            │
└──────────────────────────────────────┘
                 ↕
┌──────────────────────────────────────┐
│    Content Script (视频检测脚本)        │
└──────────────────────────────────────┘
                 ↕
┌──────────────────────────────────────┐
│   Background Service Worker           │
│   - FFmpeg 管理                       │
│   - 下载管理                          │
│   - 任务协调                          │
└──────────────────────────────────────┘
```

## 安装使用

### 开发模式

```bash
# 安装依赖
npm install

# 开发构建（监视模式）
npm run dev

# 生产构建
npm run build
```

### 加载扩展

1. 打开 Chrome/Edge 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `dist` 目录

## 项目结构

```
video-cache-downloader/
├── manifest.json          # 插件配置文件
├── package.json          # Node.js 依赖配置
├── build.js              # 构建脚本
├── src/
│   ├── background/        # 后台服务
│   │   ├── service-worker.js   # 主服务
│   │   ├── ffmpeg-manager.js   # FFmpeg 管理
│   │   └── download-manager.js  # 下载管理
│   ├── content/          # 内容脚本
│   │   └── video-scanner.js    # 视频扫描
│   ├── popup/            # 弹出窗口
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── shared/           # 共享模块
│   │   ├── constants.js
│   │   └── utils.js
│   └── assets/           # 静态资源
├── dist/                 # 构建输出
└── SPEC.md              # 项目规范
```

## 核心模块

### FFmpeg Manager

使用 `@ffmpeg/ffmpeg` 实现浏览器端视频处理：

- 格式转换（MP4 ↔ WebM）
- 视频合并
- 音频提取
- 元数据读取

### Download Manager

处理视频下载和打包：

- 流式下载（支持大文件）
- JSZip 打包压缩
- Chrome Downloads API 集成

### Video Scanner

内容脚本，负责：

- 扫描页面 video 元素
- MutationObserver 增量检测
- 网络请求拦截（可选）
- 视频元数据提取

## 权限说明

- `activeTab` - 访问当前标签页
- `storage` - 本地数据存储
- `downloads` - 触发文件下载
- `tabs` - 标签页管理
- `<all_urls>` - 访问所有网站视频

## 使用流程

1. **扫描视频** - 点击插件图标，点击"扫描视频"
2. **选择视频** - 勾选要下载的视频
3. **下载方式**:
   - 直接下载：下载原始视频
   - 转换格式：转换为 MP4 或 WebM
   - 打包下载：多个视频打包为 ZIP

## 注意事项

- 部分网站可能有反爬虫措施
- 下载前请确保有相关版权权限
- 仅支持用户主动触发的下载操作
- 视频数据不会离开用户本地

## License

MIT License
