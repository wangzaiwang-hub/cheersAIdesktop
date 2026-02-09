# 数据脱敏功能中文翻译修复总结

## 问题描述
数据脱敏页面显示的是原始翻译键（如 "tabs.rules", "sandbox.notConfigured"）而不是翻译后的中文文本。

## 根本原因
组件使用了错误的 i18n 导入和调用方式：
1. 从 `react-i18next` 直接导入而不是使用项目的 `#i18n` 别名
2. 在调用 `t()` 时传递了 `{ ns: 'dataMasking' }` 参数，但应该在 `useTranslation()` 中指定命名空间

## 解决方案

### 1. 正确的导入方式
```typescript
// ❌ 错误
import { useTranslation } from 'react-i18next'
import { useTranslation } from '@/i18n-config/lib.client'

// ✅ 正确
import { useTranslation } from '#i18n'
```

### 2. 正确的使用方式
```typescript
// ❌ 错误
const { t } = useTranslation()
const text = t('tabs.rules', { ns: 'dataMasking' })

// ✅ 正确
const { t } = useTranslation('dataMasking')
const text = t('tabs.rules')
```

### 3. 多命名空间使用
```typescript
// 当需要使用多个命名空间时
const { t } = useTranslation('dataMasking')
const { t: tCommon } = useTranslation('common')

useDocumentTitle(tCommon('menus.dataMasking'))
```

## 修改的文件

### 页面组件
- `web/app/(commonLayout)/data-masking/page.tsx`
  - 导入改为 `#i18n`
  - 添加 `useTranslation('dataMasking')`
  - 移除所有 `{ ns: 'dataMasking' }` 参数
  - 添加 `tCommon` 用于页面标题

### 子组件
- `web/app/components/data-masking/sandbox-config.tsx`
- `web/app/components/data-masking/file-masking.tsx`
- `web/app/components/data-masking/file-list.tsx`
- `web/app/components/data-masking/list.tsx`

所有组件都进行了相同的修改：
1. 导入改为 `from '#i18n'`
2. 使用 `useTranslation('dataMasking')`
3. 移除所有翻译调用中的 `{ ns: 'dataMasking' }` 参数

## 翻译文件结构

### 命名空间注册
在 `web/i18n-config/resources.ts` 中已正确注册：
```typescript
import dataMasking from '../i18n/en-US/data-masking.json'

const resources = {
  // ...
  dataMasking,
  // ...
}
```

### 翻译文件
- `web/i18n/zh-Hans/data-masking.json` - 中文翻译
- `web/i18n/en-US/data-masking.json` - 英文翻译

## 项目 i18n 约定

### #i18n 别名
在 `web/package.json` 中定义：
```json
{
  "imports": {
    "#i18n": {
      "react-server": "./i18n-config/lib.server.ts",
      "default": "./i18n-config/lib.client.ts"
    }
  }
}
```

这个别名会根据运行环境自动选择：
- 服务器端：使用 `lib.server.ts`
- 客户端：使用 `lib.client.ts`

### 命名空间加载
i18n 配置会自动加载翻译文件：
```typescript
resourcesToBackend((language: Locale, namespace: NamespaceKebabCase) => {
  const fileNamespace = kebabCase(namespace) as NamespaceKebabCase
  return import(`../i18n/${language}/${fileNamespace}.json`)
})
```

注意：
- 命名空间使用 camelCase（如 `dataMasking`）
- 文件名使用 kebab-case（如 `data-masking.json`）
- 系统会自动转换

## 验证
访问 http://localhost:3000/data-masking 应该看到：
- 页面标题：数据脱敏
- 标签页：脱敏规则、沙箱配置、文件脱敏、文件管理
- 所有内容都显示为中文

## 参考示例
可以参考其他页面的实现：
- `web/app/(commonLayout)/datasets/(datasetDetailLayout)/[datasetId]/settings/page.tsx`
- `web/app/(commonLayout)/tools/page.tsx`
