# Video Cache Downloader - 浏览器插件规范

## 1. 项目概述

**项目名称**: Video Cache Downloader (视频缓存下载器)
**项目类型**: Chrome/Edge 浏览器扩展
**核心功能**: 自动检测网页中的视频资源，缓存并转换视频格式，支持批量打包下载
**目标用户**: 需要下载网页视频的用户（教育学习、内容收藏等场景）

## 2. 功能规范

### 2.1 核心功能

- **视频检测**: 自动扫描网页中的 `<video>` 标签和网络请求中的视频资源
- **视频缓存**: 捕获并缓存视频流数据
- **格式转换**: 使用 FFmpeg WASM 将视频转换为 MP4/WebM 格式
- **批量打包**: 支持多视频打包为 ZIP 文件
- **进度追踪**: 实时显示处理进度和状态

### 2.2 用户交互流程

1. 用户点击插件图标打开弹出窗口
2. 系统自动扫描当前页面的视频资源
3. 显示检测到的视频列表（名称、大小、时长）
4. 用户选择要下载的视频（单个或批量）
5. 点击下载后，系统自动处理并提供下载

### 2.3 技术架构

```
┌─────────────────────────────────────────┐
│           Popup UI (popup.html)          │
│  - 视频列表显示                           │
│  - 下载控制                              │
│  - 进度显示                              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Content Script (injected)        │
│  - 视频元素检测                           │
│  - 网络请求拦截                           │
│  - 视频源提取                            │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│      Background Service Worker           │
│  - 任务管理                             │
│  - FFmpeg 协调                          │
│  - 下载处理                             │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           FFmpeg WASM Module             │
│  - 视频格式转换                         │
│  - 视频合并                             │
└─────────────────────────────────────────┘
```

## 3. 数据结构

### 3.1 视频信息对象

```javascript
{
  id: string,              // 唯一标识符
  url: string,             // 视频 URL
  title: string,           // 视频标题
  duration: number,        // 时长（秒）
  size: number,            // 文件大小（字节）
  type: string,            // MIME 类型
  thumbnail: string,       // 缩略图（base64）
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'error'
}
```

### 3.2 下载任务对象

```javascript
{
  taskId: string,
  videos: VideoInfo[],
  totalSize: number,
  progress: number,
  status: 'idle' | 'downloading' | 'processing' | 'packaging' | 'completed' | 'error',
  outputFormat: 'mp4' | 'webm' | 'zip',
  createdAt: timestamp
}
```

## 4. 浏览器 API 使用

### 4.1 Manifest V3 权限

- `activeTab`: 访问当前标签页
- `storage`: 本地数据存储
- `downloads`: 触发下载
- `tabs`: 标签页管理
- `webRequest`: 网络请求拦截（可选）
- `host`: 匹配所有 URL

### 4.2 消息通信

使用 `chrome.runtime.sendMessage` 和 `chrome.tabs.sendMessage` 进行前后台通信。

## 5. 依赖项

- **FFmpeg.wasm**: v0.12+ (WebAssembly 视频处理)
- **JSZip**: 打包压缩
- **FileSaver.js**: 文件下载保存

## 6. 文件结构

```
video-cache-downloader/
├── manifest.json              # 插件配置
├── package.json               # Node.js 配置
├── src/
│   ├── background/
│   │   ├── service-worker.js  # 后台服务
│   │   ├── ffmpeg-manager.js   # FFmpeg 管理
│   │   └── download-manager.js # 下载管理
│   ├── content/
│   │   ├── video-scanner.js   # 视频扫描
│   │   └── network-interceptor.js # 网络拦截
│   ├── popup/
│   │   ├── popup.html         # 弹窗界面
│   │   ├── popup.js           # 弹窗逻辑
│   │   └── popup.css          # 样式
│   ├── shared/
│   │   ├── constants.js       # 常量定义
│   │   ├── utils.js           # 工具函数
│   │   └── message-types.js   # 消息类型
│   └── assets/
│       ├── icons/             # 插件图标
│       └── ffmpeg/            # FFmpeg WASM 文件
├── dist/                      # 编译输出
└── README.md                   # 项目说明
```

## 7. UI/UX 规范

### 7.1 视觉风格

- **设计语言**: 现代简洁 Material Design
- **配色方案**:
  - 主色: `#4CAF50` (绿色 - 下载/成功)
  - 次色: `#2196F3` (蓝色 - 进度)
  - 警告色: `#FF9800` (橙色 - 处理中)
  - 错误色: `#F44336` (红色 - 错误)
  - 背景色: `#FFFFFF` / `#F5F5F5`
  - 文字色: `#212121` / `#757575`

### 7.2 组件状态

- **视频卡片**:
  - 默认: 带边框和阴影
  - 选中: 绿色边框高亮
  - 下载中: 进度条覆盖
  - 完成: 绿色勾选图标
  - 错误: 红色警告图标

### 7.3 响应式设计

- Popup 宽度: 400px
- 最大高度: 600px
- 支持滚动

## 8. 错误处理

### 8.1 错误类型

- `VIDEO_NOT_FOUND`: 未检测到视频
- `DOWNLOAD_FAILED`: 下载失败
- `FFMPEG_ERROR`: FFmpeg 处理错误
- `STORAGE_FULL`: 存储空间不足
- `NETWORK_ERROR`: 网络请求错误

### 8.2 重试机制

- 下载失败自动重试 3 次
- 指数退避策略
- 用户可手动重试

## 9. 性能优化

- 视频检测使用 MutationObserver 增量扫描
- FFmpeg 处理在后台线程执行
- 大文件使用流式处理
- 缓存清理机制（最大缓存 500MB）

## 10. 安全考虑

- 仅处理用户主动触发的下载
- 视频数据不离开用户本地
- 禁止在 incognito 模式运行
- CSP 限制外部脚本加载
