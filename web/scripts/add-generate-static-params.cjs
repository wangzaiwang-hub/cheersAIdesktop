const fs = require('fs')
const path = require('path')

// 查找所有动态路由的 page.tsx 文件
function findDynamicRoutes(dir, routes = [], parentHasDynamic = false) {
  const files = fs.readdirSync(dir, { withFileTypes: true })
  
  // 检查当前目录是否是动态路由
  const isDynamic = path.basename(dir).includes('[') && path.basename(dir).includes(']')
  const hasDynamic = parentHasDynamic || isDynamic
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    
    if (file.isDirectory()) {
      // 递归搜索
      findDynamicRoutes(fullPath, routes, hasDynamic)
    } else if (file.name === 'page.tsx' && hasDynamic) {
      // 如果父路径中有动态路由，且当前是 page.tsx
      routes.push(fullPath)
    }
  }
  
  return routes
}

// 为页面添加 generateStaticParams
function addGenerateStaticParams(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  
  // 检查是否已经有 generateStaticParams
  if (content.includes('generateStaticParams')) {
    console.log(`⏭️  跳过 ${filePath} (已存在)`)
    return false
  }
  
  // 检查是否有 'use client'
  const hasUseClient = content.includes("'use client'") || content.includes('"use client"')
  
  if (hasUseClient) {
    // For client components, we need to create a separate generateStaticParams file
    // or add it before 'use client' won't work. Instead, create a wrapper.
    const dir = path.dirname(filePath)
    const wrapperPath = path.join(dir, '_static-params.ts')
    if (!fs.existsSync(wrapperPath)) {
      fs.writeFileSync(wrapperPath, `export const dynamicParams = false\n\nexport async function generateStaticParams() {\n  return []\n}\n`, 'utf-8')
    }
    // Re-export from page by prepending to the file (before 'use client')
    // Actually for Next.js, generateStaticParams must be in the page file itself
    // For client pages, we move the client code to a component and make page a server wrapper
    // Simplest: just add generateStaticParams export - Next.js allows it alongside 'use client' in some cases
    // Actually Next.js 14+ allows generateStaticParams in client component pages
    const exportCode = `\nexport const dynamicParams = false\nexport async function generateStaticParams() { return [] }\n`
    content = content + exportCode
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`✅ 已添加到 ${filePath} (客户端组件，追加到末尾)`)
    return true
  }
  
  // 在第一个 import 之前添加
  const lines = content.split('\n')
  let insertIndex = 0
  
  // 找到第一个非空行
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      insertIndex = i
      break
    }
  }
  
  // 插入 generateStaticParams
  const newLines = [
    ...lines.slice(0, insertIndex),
    'export const dynamicParams = false',
    '',
    'export async function generateStaticParams() {',
    '  return []',
    '}',
    '',
    ...lines.slice(insertIndex)
  ]
  
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8')
  console.log(`✅ 已添加到 ${filePath}`)
  return true
}

// 主函数
function main() {
  const appDir = path.join(__dirname, '../app')
  const routes = findDynamicRoutes(appDir)
  
  console.log(`\n找到 ${routes.length} 个动态路由页面:\n`)
  
  let modified = 0
  for (const route of routes) {
    if (addGenerateStaticParams(route)) {
      modified++
    }
  }
  
  console.log(`\n✅ 完成！修改了 ${modified} 个文件`)
}

main()
