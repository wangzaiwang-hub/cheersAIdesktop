const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🚀 开始构建 CheersAI Electron 应用...\n')

const shareLayoutPath = path.join(__dirname, '../app/(shareLayout)')
const shareLayoutBackupPath = path.join(__dirname, '../.shareLayout.backup')
const exploreInstalledPath = path.join(__dirname, '../app/(commonLayout)/explore/installed')
const exploreInstalledBackupPath = path.join(__dirname, '../.exploreInstalled.backup')
const appDetailLayoutPath = path.join(__dirname, '../app/(commonLayout)/app/(appDetailLayout)')
const appDetailLayoutBackupPath = path.join(__dirname, '../.appDetailLayout.backup')
const datasetsPath = path.join(__dirname, '../app/(commonLayout)/datasets')
const datasetsBackupPath = path.join(__dirname, '../.datasets.backup')

// 0. 生成图标文件
console.log('🎨 步骤 0/6: 生成应用图标...')
try {
  execSync('node scripts/create-icon.cjs', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
  console.log('✅ 图标生成完成\n')
} catch (error) {
  console.error('❌ 图标生成失败:', error.message)
  process.exit(1)
}

// 1. 临时禁用不需要的动态路由
console.log('📦 步骤 1/6: 准备构建环境...')
try {
  // 禁用 Web 分享页面
  if (fs.existsSync(shareLayoutPath)) {
    fs.cpSync(shareLayoutPath, shareLayoutBackupPath, { recursive: true })
    fs.rmSync(shareLayoutPath, { recursive: true, force: true })
    console.log('✅ 已临时禁用 Web 分享页面')
  }
  
  // 禁用 explore/installed 动态路由（Electron 不需要）
  if (fs.existsSync(exploreInstalledPath)) {
    fs.cpSync(exploreInstalledPath, exploreInstalledBackupPath, { recursive: true })
    fs.rmSync(exploreInstalledPath, { recursive: true, force: true })
    console.log('✅ 已临时禁用 explore/installed 页面')
  }
  
  // 禁用 app 详情页面（Electron 不需要）
  if (fs.existsSync(appDetailLayoutPath)) {
    fs.cpSync(appDetailLayoutPath, appDetailLayoutBackupPath, { recursive: true })
    fs.rmSync(appDetailLayoutPath, { recursive: true, force: true })
    console.log('✅ 已临时禁用 app 详情页面')
  }
  
  // 禁用整个 datasets 目录（使用了服务器端功能）
  if (fs.existsSync(datasetsPath)) {
    fs.cpSync(datasetsPath, datasetsBackupPath, { recursive: true })
    fs.rmSync(datasetsPath, { recursive: true, force: true })
    console.log('✅ 已临时禁用 datasets 目录')
  }
  
  // 临时移除 Google Fonts（避免网络问题）
  const layoutPath = path.join(__dirname, '../app/layout.tsx')
  const layoutBackupPath = path.join(__dirname, '../app/layout.tsx.backup')
  if (fs.existsSync(layoutPath)) {
    fs.copyFileSync(layoutPath, layoutBackupPath)
    let layoutContent = fs.readFileSync(layoutPath, 'utf-8')
    
    // 注释掉 Google Fonts 导入和使用
    layoutContent = layoutContent.replace(
      "import { Instrument_Serif } from 'next/font/google'",
      "// import { Instrument_Serif } from 'next/font/google'"
    )
    layoutContent = layoutContent.replace(
      /const instrumentSerif = Instrument_Serif\({[\s\S]*?}\)/,
      '// const instrumentSerif = Instrument_Serif({ ... })'
    )
    layoutContent = layoutContent.replace(
      "className={cn('h-full', instrumentSerif.variable)}",
      "className={cn('h-full')}"
    )
    
    // 移除 PWA Provider（Electron 不需要）
    layoutContent = layoutContent.replace(
      "import { PWAProvider } from './components/provider/serwist'",
      "// import { PWAProvider } from './components/provider/serwist'"
    )
    layoutContent = layoutContent.replace(
      /<PWAProvider>/g,
      '<>'
    )
    layoutContent = layoutContent.replace(
      /<\/PWAProvider>/g,
      '</>'
    )
    
    fs.writeFileSync(layoutPath, layoutContent, 'utf-8')
    console.log('✅ 已临时移除 Google Fonts 和 PWA\n')
  }
} catch (error) {
  console.error('❌ 准备构建环境失败:', error.message)
  process.exit(1)
}

// 2. 为动态路由添加 generateStaticParams
console.log('📦 步骤 2/6: 为动态路由添加 generateStaticParams...')
try {
  execSync('node scripts/add-generate-static-params.cjs', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
  console.log('✅ generateStaticParams 添加完成\n')
} catch (error) {
  console.error('❌ 添加 generateStaticParams 失败:', error.message)
  
  // 恢复所有页面
  const restorePaths = [
    [shareLayoutBackupPath, shareLayoutPath],
    [exploreInstalledBackupPath, exploreInstalledPath],
    [appDetailLayoutBackupPath, appDetailLayoutPath],
    [datasetsBackupPath, datasetsPath],
    [datasetsBackupPath, datasetsPath]
  ]
  
  for (const [backupPath, originalPath] of restorePaths) {
    if (fs.existsSync(backupPath)) {
      if (fs.existsSync(originalPath)) {
        fs.rmSync(originalPath, { recursive: true, force: true })
      }
      fs.cpSync(backupPath, originalPath, { recursive: true })
      fs.rmSync(backupPath, { recursive: true, force: true })
    }
  }
  
  // 恢复 layout.tsx
  const layoutPath = path.join(__dirname, '../app/layout.tsx')
  const layoutBackupPath = path.join(__dirname, '../app/layout.tsx.backup')
  if (fs.existsSync(layoutBackupPath)) {
    fs.copyFileSync(layoutBackupPath, layoutPath)
    fs.unlinkSync(layoutBackupPath)
  }
  
  process.exit(1)
}

// 3. 使用 Electron 配置构建 Next.js
console.log('📦 步骤 3/6: 构建 Next.js 应用（静态导出）...')
try {
  // 清理之前的构建（使用 PowerShell 命令更可靠）
  const nextDir = path.join(__dirname, '../.next')
  if (fs.existsSync(nextDir)) {
    try {
      execSync(`powershell -Command "Remove-Item -Path '${nextDir}' -Recurse -Force -ErrorAction SilentlyContinue"`, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      })
      console.log('✅ 已清理之前的构建缓存')
    } catch (e) {
      console.log('⚠️  清理缓存失败，继续构建...')
    }
  }
  
  const originalConfig = path.join(__dirname, '../next.config.ts')
  const electronConfig = path.join(__dirname, '../next.config.electron.ts')
  const backupConfig = path.join(__dirname, '../next.config.ts.backup')

  if (fs.existsSync(originalConfig)) {
    fs.renameSync(originalConfig, backupConfig)
  }

  fs.copyFileSync(electronConfig, originalConfig)

  execSync('npx pnpm next build', { stdio: 'inherit', cwd: path.join(__dirname, '..') })

  fs.unlinkSync(originalConfig)
  if (fs.existsSync(backupConfig)) {
    fs.renameSync(backupConfig, originalConfig)
  }

  console.log('✅ Next.js 构建完成\n')
} catch (error) {
  console.error('❌ Next.js 构建失败:', error.message)
  
  // 恢复配置
  const originalConfig = path.join(__dirname, '../next.config.ts')
  const backupConfig = path.join(__dirname, '../next.config.ts.backup')
  if (fs.existsSync(backupConfig)) {
    if (fs.existsSync(originalConfig)) {
      fs.unlinkSync(originalConfig)
    }
    fs.renameSync(backupConfig, originalConfig)
  }
  
  // 恢复所有页面
  const restorePaths = [
    [shareLayoutBackupPath, shareLayoutPath],
    [exploreInstalledBackupPath, exploreInstalledPath],
    [appDetailLayoutBackupPath, appDetailLayoutPath],
    [datasetsBackupPath, datasetsPath],
    [datasetsBackupPath, datasetsPath]
  ]
  
  for (const [backupPath, originalPath] of restorePaths) {
    if (fs.existsSync(backupPath)) {
      if (fs.existsSync(originalPath)) {
        fs.rmSync(originalPath, { recursive: true, force: true })
      }
      fs.cpSync(backupPath, originalPath, { recursive: true })
      fs.rmSync(backupPath, { recursive: true, force: true })
    }
  }
  
  // 恢复 layout.tsx
  const layoutPath = path.join(__dirname, '../app/layout.tsx')
  const layoutBackupPath = path.join(__dirname, '../app/layout.tsx.backup')
  if (fs.existsSync(layoutBackupPath)) {
    fs.copyFileSync(layoutBackupPath, layoutPath)
    fs.unlinkSync(layoutBackupPath)
  }
  
  process.exit(1)
}

// 4. 恢复页面
console.log('📦 步骤 4/6: 恢复构建环境...')
try {
  const restorePaths = [
    [shareLayoutBackupPath, shareLayoutPath, 'Web 分享页面'],
    [exploreInstalledBackupPath, exploreInstalledPath, 'explore/installed 页面'],
    [appDetailLayoutBackupPath, appDetailLayoutPath, 'app 详情页面'],
    [datasetsBackupPath, datasetsPath, 'datasets 目录']
  ]
  
  for (const [backupPath, originalPath, name] of restorePaths) {
    if (fs.existsSync(backupPath)) {
      if (fs.existsSync(originalPath)) {
        fs.rmSync(originalPath, { recursive: true, force: true })
      }
      fs.cpSync(backupPath, originalPath, { recursive: true })
      fs.rmSync(backupPath, { recursive: true, force: true })
      console.log(`✅ 已恢复 ${name}`)
    }
  }
  
  // 恢复 layout.tsx
  const layoutPath = path.join(__dirname, '../app/layout.tsx')
  const layoutBackupPath = path.join(__dirname, '../app/layout.tsx.backup')
  if (fs.existsSync(layoutBackupPath)) {
    fs.copyFileSync(layoutBackupPath, layoutPath)
    fs.unlinkSync(layoutBackupPath)
    console.log('✅ 已恢复 layout.tsx\n')
  }
} catch (error) {
  console.error('⚠️  恢复页面失败:', error.message)
}

// 5. 检查 out 目录
console.log('📦 步骤 5/6: 检查构建输出...')
const outDir = path.join(__dirname, '../out')
if (!fs.existsSync(outDir)) {
  console.error('❌ 错误: out 目录不存在')
  console.error('   Next.js 可能没有正确导出静态文件')
  process.exit(1)
}
console.log('✅ 构建输出检查通过\n')

// 6. 使用 electron-builder 打包
console.log('📦 步骤 6/6: 使用 Electron Builder 打包...')
try {
  const platform = process.argv[2] || 'win'
  let buildCommand
  
  switch (platform) {
    case 'win':
      buildCommand = 'npx electron-builder --win'
      break
    case 'mac':
      buildCommand = 'npx electron-builder --mac'
      break
    case 'linux':
      buildCommand = 'npx electron-builder --linux'
      break
    case 'all':
      buildCommand = 'npx electron-builder -mwl'
      break
    default:
      buildCommand = `npx electron-builder --${platform}`
  }

  execSync(buildCommand, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
  console.log('✅ Electron 打包完成\n')
} catch (error) {
  console.error('❌ Electron 打包失败:', error.message)
  process.exit(1)
}

console.log('🎉 构建完成！')
console.log('📁 输出目录: web/dist-electron')
console.log('\n可用的安装包：')
const distDir = path.join(__dirname, '../dist-electron')
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir)
  files.forEach(file => {
    if (file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.AppImage') || file.endsWith('.deb')) {
      console.log(`  ✓ ${file}`)
    }
  })
}

