# Better Doubao

> 🔥 灵感来源于 [gemini-voyage](https://github.com/Nagi-ovo/gemini-voyager)，感谢作者的开源贡献！

A powerful browser extension to enhance your Doubao chat experience

## 功能概述

### 1. 快速定位 (Quick Locator)

快速导航到对话中的任意消息。

**功能特点：**
- 在页面悬浮窗中显示所有消息列表
- 支持收藏重要消息
- 收藏信息持久化存储，跨对话可用
- 点击消息自动滚动定位

**使用方式：**
- 点击页面左上角的定位图标展开悬浮窗
- 点击消息项快速跳转
- 点击星标图标收藏/取消收藏

![快速定位](docs/images/3.png)

---

### 2. 文件夹管理 (Folder Manager)

将对话整理到自定义文件夹中。

**功能特点：**
- 创建彩色标签文件夹
- 拖拽对话到文件夹
- 支持跨对话组织
- 数据持久化存储

**使用方式：**
- 点击侧边栏文件夹图标
- 创建新文件夹并选择颜色
- 拖拽对话到目标文件夹

![文件夹管理](docs/images/1.png)

---

### 3. 语料板 (Corpus Board)

跨对话收集和复用文本片段。

**功能特点：**
- 页面右侧拖拽工具按钮
- 选中文本后显示添加按钮
- 语料持久化存储
- 一键将语料插入输入框（用 `[]` 包围）

**使用方式：**
- 拖拽工具按钮到合适位置
- 选中文本点击「添加到语料板」
- 点击语料板中的项目插入输入框

![语料板](docs/images/2.png)

---

### 4. 导出功能 (Export)

将对话内容导出为多种格式。

**功能特点：**
- 支持 PDF、TXT、Markdown 三种格式
- 正确区分用户/AI 消息
- 支持图片导出（过滤占位图）
- 与豆包原生界面风格一致

**使用方式：**
- 点击顶部导航栏导出按钮
- 选择导出格式
- 自动下载或打开打印预览

![导出功能](docs/images/4.png)

---

## 技术架构

### 项目结构

```
doubao-voyager/
├── src/
│   ├── core/                    # 核心模块
│   │   ├── services/
│   │   │   └── StorageService.ts  # 存储服务
│   │   ├── types/
│   │   │   └── folder.ts         # 类型定义
│   │   └── index.ts
│   ├── features/                 # 功能模块
│   │   ├── quicklocator/        # 快速定位
│   │   ├── folder/              # 文件夹管理
│   │   ├── corpusboard/         # 语料板
│   │   └── export/              # 导出功能
│   ├── pages/
│   │   ├── content/             # 内容脚本
│   │   ├── background/          # 后台脚本
│   │   ├── popup/               # 弹出页面
│   │   └── options/             # 设置页面
│   └── assets/
│       └── styles/
│           └── content.css      # 样式
├── manifest.json                # 插件清单
├── vite.config.ts               # Vite 配置
└── package.json                 # 依赖配置
```

### 技术栈

- **语言**: TypeScript
- **构建工具**: Vite + @crxjs/vite-plugin
- **浏览器 API**: Chrome Extension Manifest V3
- **存储**: chrome.storage.local
- **样式**: 原生 CSS

### 开发命令

```bash
# 开发模式（监听文件变化）
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run typecheck
```

### 技术实现要点

1. **DOM 注入**: 通过 content script 注入功能代码到页面
2. **元素定位**: 使用 CSS 选择器和 MutationObserver 监听页面变化
3. **状态管理**: 单例模式管理各功能模块状态
4. **持久化**: 使用 chrome.storage API 存储用户数据
5. **样式隔离**: 使用唯一 class 前缀避免冲突

---

## 安装使用

1. 克隆项目
2. 安装依赖：`npm install`
3. 构建项目：`npm run build`
4. 在 Chrome 中打开 `chrome://extensions/`
5. 开启「开发者模式」
6. 点击「加载已解压的扩展程序」
7. 选择 `dist` 目录
