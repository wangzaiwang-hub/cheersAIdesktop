# Electron 桌面应用构建指南

## 构建问题说明

当前 Electron 构建遇到以下技术挑战：

### 1. 动态路由问题
- Next.js 静态导出不支持带有动态参数的路由
- 已临时移除 app 详情页面和 dataset 详情页面

### 2. Google Fonts 网络问题
- 构建时无法访问 Google Fonts API
- 已临时移除 Instrument Serif 字体

### 3. PWA/Serwist 依赖问题
- esbuild-wasm 模块路径解析问题
- 已临时移除 PWA 功能（Electron 不需要）

### 4. 构建缓存问题
- `.next` 目录清理可能失败
- 使用 PowerShell 命令强制清理

## 构建命令

```bash
# Windows
pnpm run build:electron:win

# macOS
pnpm run build:electron:mac

# Linux
pnpm run build:electron:linux
```

## 构建步骤

脚本会自动执行以下步骤：

1. 生成应用图标
2. 准备构建环境（临时移除不需要的功能）
3. 为动态路由添加 generateStaticParams
4. 构建 Next.js 应用（静态导出）
5. 恢复构建环境
6. 使用 Electron Builder 打包

## 输出位置

构建完成后，安装包位于：`web/dist-electron/`

## 已知限制

由于是静态导出，以下功能在 Electron 版本中不可用：
- App 详情页面（需要动态路由）
- Dataset 详情页面（需要动态路由）
- Explore 已安装应用页面
- PWA 功能

## 建议

对于完整功能，建议使用 Web 版本或考虑使用 Tauri 替代 Electron。
