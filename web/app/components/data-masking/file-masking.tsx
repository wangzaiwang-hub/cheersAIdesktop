'use client'

import { useState } from 'react'
import { DocumentIcon, EyeIcon, PlayIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import type { MaskingRule } from '@/lib/data-masking/types'
import { isTauri, writeFileToSandbox } from '@/lib/data-masking/tauri-fs'
import { saveSandboxFile } from '@/service/sandbox-files'

interface FileMaskingProps {
  rules: MaskingRule[]
  sandboxPath: string
  dirHandle?: FileSystemDirectoryHandle
}

function applyRules(content: string, rules: MaskingRule[], selectedIds: string[]): { masked: string; count: number } {
  let masked = content
  let totalCount = 0
  const activeRules = rules
    .filter(r => selectedIds.includes(r.id) && r.enabled)
    .sort((a, b) => a.priority - b.priority)

  for (const rule of activeRules) {
    const pattern = typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.source
    const regex = new RegExp(pattern, 'g')
    const replacement = rule.strategy.type === 'replacement'
      ? (rule.strategy as { type: 'replacement'; value: string }).value
      : rule.strategy.type === 'tokenization'
        ? `${(rule.strategy as { type: 'tokenization'; prefix: string }).prefix}_TOKEN`
        : '***'
    let matchCount = 0
    masked = masked.replace(regex, () => { matchCount++; return replacement })
    totalCount += matchCount
  }
  return { masked, count: totalCount }
}

function getMaskedFileName(originalName: string): string {
  const dotIdx = originalName.lastIndexOf('.')
  if (dotIdx === -1) return `${originalName}.masked`
  return `${originalName.substring(0, dotIdx)}.masked${originalName.substring(dotIdx)}`
}

export function FileMasking({ rules, sandboxPath, dirHandle }: FileMaskingProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [selectedRules, setSelectedRules] = useState<string[]>([])
  const [preview, setPreview] = useState('')
  const [maskedContent, setMaskedContent] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.md')) {
      setError('目前仅支持 .md (Markdown) 文件')
      return
    }

    setSelectedFile(file)
    setPreview('')
    setMaskedContent('')
    setShowSuccess(false)

    const reader = new FileReader()
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string ?? '')
    }
    reader.onerror = () => setError('读取文件失败')
    reader.readAsText(file)
  }

  const handleRuleToggle = (ruleId: string) => {
    setSelectedRules(prev =>
      prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId],
    )
    setPreview('')
    setMaskedContent('')
  }

  const handlePreview = () => {
    if (!selectedFile || !fileContent || selectedRules.length === 0) return
    setIsProcessing(true)
    setError('')
    try {
      const { masked, count } = applyRules(fileContent, rules, selectedRules)
      setMaskedContent(masked)
      setMatchCount(count)
      setPreview(masked.length > 2000 ? masked.substring(0, 2000) + '\n\n... (已截断)' : masked)
    }
    catch (err) {
      setError(`脱敏预览失败: ${err}`)
    }
    finally {
      setIsProcessing(false)
    }
  }

  const handleExecute = async () => {
    if (!selectedFile || !maskedContent) return
    setIsProcessing(true)
    setError('')
    const maskedFileName = getMaskedFileName(selectedFile.name)
    const messages: string[] = []

    // 1) Save to sandbox directory
    const isBrowserDirPath = sandboxPath.startsWith('[浏览器目录]')
    if (sandboxPath) {
      try {
        if (dirHandle) {
          // Browser File System Access API — write directly to user-picked directory
          const fileHandle = await dirHandle.getFileHandle(maskedFileName, { create: true })
          const writable = await (fileHandle as unknown as { createWritable: () => Promise<WritableStream> }).createWritable()
          const writer = writable.getWriter()
          await writer.write(maskedContent)
          await writer.close()
          messages.push(`已保存到 ${dirHandle.name}/${maskedFileName}`)
        }
        else if (isBrowserDirPath) {
          // Browser dir handle lost (page refresh) — skip backend call, just do browser download
          messages.push('浏览器目录句柄已失效，请重新选择目录。本次仅触发浏览器下载。')
        }
        else if (isTauri()) {
          await writeFileToSandbox(sandboxPath, maskedFileName, maskedContent)
          messages.push(`已保存到 ${sandboxPath}`)
        }
        else {
          const result = await saveSandboxFile(sandboxPath, maskedFileName, maskedContent)
          messages.push(`已保存到 ${result.file_path}`)
        }
      }
      catch (saveErr) {
        messages.push(`沙箱保存失败: ${saveErr instanceof Error ? saveErr.message : saveErr}`)
      }
    }

    // 2) Browser download (always)
    try {
      const blob = new Blob([maskedContent], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = maskedFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      messages.push('浏览器下载已触发')
    }
    catch {
      messages.push('浏览器下载失败')
    }

    // 3) IndexedDB backup
    saveMaskedFile(maskedFileName, maskedContent)

    setIsProcessing(false)
    // Show result with details
    const hasError = messages.some(m => m.includes('失败'))
    if (hasError)
      setError(messages.join('；'))
    else
      setShowSuccess(true)
  }

  const saveMaskedFile = (fileName: string, content: string) => {
    const request = indexedDB.open('data-masking-db', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('masked_files')) {
        db.createObjectStore('masked_files', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('masked_files')) {
        db.close()
        return
      }
      const tx = db.transaction('masked_files', 'readwrite')
      tx.objectStore('masked_files').put({
        id: `${Date.now()}-${fileName}`,
        fileName,
        content,
        originalName: selectedFile?.name,
        sandboxPath,
        matchCount,
        createdAt: new Date().toISOString(),
      })
      db.close()
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setFileContent('')
    setSelectedRules([])
    setPreview('')
    setMaskedContent('')
    setMatchCount(0)
    setShowSuccess(false)
    setError('')
  }

  if (showSuccess) {
    return (
      <div className="text-center py-12">
        <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">脱敏完成</h3>
        <p className="mt-1 text-sm text-gray-500">
          已匹配并替换 {matchCount} 处敏感数据
        </p>
        <p className="mt-1 text-xs text-gray-400">
          文件名: {selectedFile ? getMaskedFileName(selectedFile.name) : ''}
          {sandboxPath && ` → ${sandboxPath}`}
        </p>
        <button
          onClick={handleReset}
          className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          脱敏其他文件
        </button>
      </div>
    )
  }

  const enabledRules = rules.filter(r => r.enabled)

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* File Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择要脱敏的 Markdown 文件
        </label>
        <input
          type="file"
          accept=".md"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-medium
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
        {selectedFile && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <DocumentIcon className="h-4 w-4" />
            <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}
      </div>

      {/* Rule Selection */}
      {selectedFile && fileContent && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择脱敏规则
          </label>
          {enabledRules.length === 0 ? (
            <p className="text-sm text-gray-500">暂无已启用的脱敏规则，请先在「脱敏规则」标签页创建并启用规则</p>
          ) : (
            <div className="space-y-2">
              {enabledRules.map(rule => (
                <label
                  key={rule.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRules.includes(rule.id)}
                    onChange={() => handleRuleToggle(rule.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                    <div className="text-xs text-gray-500">{rule.description}</div>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    {typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.source}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              脱敏预览 (匹配 {matchCount} 处)
            </label>
            <span className="text-xs text-gray-400">
              输出文件: {selectedFile ? getMaskedFileName(selectedFile.name) : ''}
            </span>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md max-h-80 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{preview}</pre>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={!selectedFile || !fileContent || selectedRules.length === 0 || isProcessing}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <EyeIcon className="h-4 w-4" />
          预览脱敏
        </button>
        <button
          type="button"
          onClick={handleExecute}
          disabled={!maskedContent || isProcessing}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlayIcon className="h-4 w-4" />
          执行脱敏并下载
        </button>
      </div>
    </div>
  )
}
