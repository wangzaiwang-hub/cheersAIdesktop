# 数据脱敏功能 (Data Masking Feature)

本目录包含数据脱敏功能的核心实现。

## 📁 目录结构

```
web/lib/data-masking/
├── README.md                    # 本文档
├── types.ts                     # 核心类型定义
├── database.ts                  # SQLite 数据库管理（Electron/Tauri）
├── indexeddb.ts                 # IndexedDB 实现（浏览器）
├── masking-engine.ts            # 脱敏引擎
├── mapping-store.ts             # 映射存储
├── sandbox-manager.ts           # 沙箱管理器
├── reverse-substitution.ts      # 反向替换器
├── file-uploader.ts             # 文件上传器
├── error-handler.ts             # 错误处理
├── logger.ts                    # 日志记录
└── __tests__/                   # 测试文件
    ├── masking-engine.test.ts
    ├── masking-engine.property.test.ts
    ├── mapping-store.test.ts
    ├── mapping-store.property.test.ts
    ├── sandbox-manager.test.ts
    ├── sandbox-manager.property.test.ts
    ├── reverse-substitution.test.ts
    ├── reverse-substitution.property.test.ts
    └── ...
```

## 🎯 核心组件

### 1. 脱敏引擎 (MaskingEngine)
负责识别和替换敏感数据。

**主要功能**:
- 应用脱敏规则识别敏感数据
- 支持三种脱敏策略：替换、令牌化、格式保留
- 生成映射关系

### 2. 映射存储 (MappingStore)
管理原始值与脱敏值的映射关系。

**主要功能**:
- 存储和检索映射数据
- AES-256 加密原始敏感值
- 集成操作系统凭据管理

### 3. 沙箱管理器 (SandboxManager)
管理本地隔离目录。

**主要功能**:
- 配置和验证沙箱路径
- 沙箱内文件操作
- 强制沙箱边界

### 4. 反向替换器 (ReverseSubstitution)
恢复脱敏数据。

**主要功能**:
- 识别响应中的脱敏值
- 查询映射并替换为原始值
- 支持多种响应格式

### 5. 文件上传器 (FileUploader)
上传文件到 Dify 后端。

**主要功能**:
- 验证文件在沙箱内
- 上传进度跟踪
- 重试机制

## 🗄️ 数据存储

### Electron/Tauri 环境
使用 **SQLite** (better-sqlite3) 存储数据。

### 浏览器环境
使用 **IndexedDB** 存储数据。

## 🔐 安全特性

1. **加密存储**: 原始敏感值使用 AES-256-GCM 加密
2. **密钥管理**: 使用操作系统凭据管理系统
3. **沙箱隔离**: 强制文件操作在沙箱内
4. **日志安全**: 日志不包含原始敏感数据

## 🧪 测试策略

### 单元测试
使用 **Vitest** 进行单元测试。

```bash
pnpm test
```

### 属性测试
使用 **fast-check** 进行基于属性的测试。

```bash
pnpm test
```

### 测试覆盖率
```bash
pnpm test:coverage
```

## 📝 使用示例

### 脱敏文件

```typescript
import { MaskingEngine } from '@/lib/data-masking/masking-engine'
import { MappingStore } from '@/lib/data-masking/mapping-store'
import { SandboxManager } from '@/lib/data-masking/sandbox-manager'

// 1. 配置沙箱
const sandbox = new SandboxManager()
await sandbox.configureSandbox('/path/to/sandbox')

// 2. 创建脱敏规则
const rules = [
  {
    id: '1',
    name: 'Email',
    pattern: /\b[\w.-]+@[\w.-]+\.\w+\b/g,
    strategy: { type: 'replacement', value: '***@***.***' },
    enabled: true,
    priority: 0,
  },
]

// 3. 执行脱敏
const engine = new MaskingEngine()
const result = await engine.maskContent(fileContent, rules)

// 4. 保存脱敏文件
await sandbox.saveFile('masked-file.txt', result.maskedContent)

// 5. 存储映射
const store = new MappingStore()
await store.storeMapping({
  id: result.mappingId,
  fileName: 'file.txt',
  entries: result.entries,
  createdAt: new Date(),
  fileHash: hash(fileContent),
})
```

### 反向替换

```typescript
import { ReverseSubstitution } from '@/lib/data-masking/reverse-substitution'
import { MappingStore } from '@/lib/data-masking/mapping-store'

// 1. 接收 Dify 后端响应
const response = await difyAPI.process(maskedFile)

// 2. 执行反向替换
const reverseSubstitution = new ReverseSubstitution()
const store = new MappingStore()

const result = await reverseSubstitution.substitute(
  response,
  mappingId,
  store,
)

// 3. 显示恢复后的结果
console.log(result.response) // 原始敏感数据已恢复
```

## 🔗 相关文档

- [需求文档](../../../.kiro/specs/data-masking/requirements.md)
- [设计文档](../../../.kiro/specs/data-masking/design.md)
- [任务列表](../../../.kiro/specs/data-masking/tasks.md)

## 📦 依赖项

- `better-sqlite3` - SQLite 数据库（Electron/Tauri）
- `fast-check` - 属性测试库
- `vitest` - 测试框架
- `crypto` - 加密功能（Node.js 内置）

## 🚀 开发指南

1. **添加新功能**: 先编写测试，然后实现功能（TDD）
2. **修改接口**: 更新 `types.ts` 中的类型定义
3. **添加测试**: 同时编写单元测试和属性测试
4. **运行测试**: `pnpm test` 确保所有测试通过

## 📄 许可证

本项目遵循 [Dify Open Source License](../../../LICENSE)。
