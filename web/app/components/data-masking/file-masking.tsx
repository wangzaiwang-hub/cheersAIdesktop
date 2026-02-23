'use client'

import { useState } from 'react'
import {
  DocumentIcon,
  EyeIcon,
  PlayIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { saveSandboxFile } from '@/service/sandbox-files'
import { scanEntities } from '@/service/sandbox-files'
import type { NerEntity } from '@/service/sandbox-files'

interface FileMaskingProps {
  sandboxPath: string
}

interface ConfirmableEntity extends NerEntity {
  checked: boolean
  replacement: string
}

function getMaskedFileName(originalName: string): string {
  const dotIdx = originalName.lastIndexOf('.')
  if (dotIdx === -1) return `${originalName}.masked`
  return `${originalName.substring(0, dotIdx)}.masked${originalName.substring(dotIdx)}`
}

function applyEntityMasking(
  content: string,
  entities: ConfirmableEntity[],
): { masked: string; count: number } {
  let masked = content
  let totalCount = 0
  // Sort by text length descending to avoid partial replacements
  const sorted = [...entities]
    .filter(e => e.checked)
    .sort((a, b) => b.text.length - a.text.length)
  for (const entity of sorted) {
    const escaped = entity.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'g')
    let matchCount = 0
    masked = masked.replace(regex, () => { matchCount++; return entity.replacement })
    totalCount += matchCount
  }
  return { masked, count: totalCount }
}

type Step = 'upload' | 'scanning' | 'confirm' | 'preview' | 'done'

export function FileMasking({ sandboxPath }: FileMaskingProps) {
  const [step, setStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [entities, setEntities] = useState<ConfirmableEntity[]>([])
  const [preview, setPreview] = useState('')
  const [maskedContent, setMaskedContent] = useState('')
  const [matchCount, setMatchCount] = useState(0)
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
    setStep('upload')
    setEntities([])
    setPreview('')
    setMaskedContent('')
    const reader = new FileReader()
    reader.onload = (ev) => { setFileContent(ev.target?.result as string ?? '') }
    reader.onerror = () => setError('读取文件失败')
    reader.readAsText(file)
  }

  const handleScan = async () => {
    if (!fileContent) return
    setStep('scanning')
    setError('')
    try {
      const result = await scanEntities(fileContent)
      const confirmable: ConfirmableEntity[] = result.map((e, i) => ({
        ...e,
        checked: true,
        replacement: `[${e.label}_${String(i + 1).padStart(3, '0')}]`,
      }))
      setEntities(confirmable)
      setStep('confirm')
    }
    catch (err) {
      setError(`NER 扫描失败: ${err instanceof Error ? err.message : err}`)
      setStep('upload')
    }
  }

  const handleToggleEntity = (idx: number) => {
    setEntities(prev => prev.map((e, i) => i === idx ? { ...e, checked: !e.checked } : e))
  }

  const handleToggleAll = (checked: boolean) => {
    setEntities(prev => prev.map(e => ({ ...e, checked })))
  }

  const handleReplacementChange = (idx: number, value: string) => {
    setEntities(prev => prev.map((e, i) => i === idx ? { ...e, replacement: value } : e))
  }

  const handlePreview = () => {
    const checked = entities.filter(e => e.checked)
    if (checked.length === 0) {
      setError('请至少选择一个实体进行脱敏')
      return
    }
    const { masked, count } = applyEntityMasking(fileContent, entities)
    setMaskedContent(masked)
    setMatchCount(count)
    setPreview(masked.length > 3000 ? masked.substring(0, 3000) + '\n\n... (已截断)' : masked)
    setStep('preview')
  }

  const handleExecute = async () => {
    if (!selectedFile || !maskedContent) return
    setError('')
    const maskedFileName = getMaskedFileName(selectedFile.name)
    const messages: string[] = []

    if (sandboxPath) {
      try {
        const result = await saveSandboxFile(sandboxPath, maskedFileName, maskedContent)
        messages.push(`已保存到 ${result.file_path}`)
      }
      catch (saveErr) {
        messages.push(`保存失败: ${saveErr instanceof Error ? saveErr.message : saveErr}`)
      }
    }

    // Browser download
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

    const hasError = messages.some(m => m.includes('失败'))
    if (hasError)
      setError(messages.join('；'))
    else
      setStep('done')
  }

  const handleReset = () => {
    setSelectedFile(null)
    setFileContent('')
    setEntities([])
    setPreview('')
    setMaskedContent('')
    setMatchCount(0)
    setStep('upload')
    setError('')
  }

  // --- Done screen ---
  if (step === 'done') {
    return (
      <div className="text-center py-12">
        <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">脱敏完成</h3>
        <p className="mt-1 text-sm text-gray-500">已替换 {matchCount} 处敏感数据</p>
        <p className="mt-1 text-xs text-gray-400">
          文件: {selectedFile ? getMaskedFileName(selectedFile.name) : ''} → {sandboxPath}
        </p>
        <button onClick={handleReset}
          className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          脱敏其他文件
        </button>
      </div>
    )
  }

  const checkedCount = entities.filter(e => e.checked).length

  // Group entities by label for display
  const grouped: Record<string, ConfirmableEntity[]> = {}
  entities.forEach((e, idx) => {
    const key = e.label
    if (!grouped[key]) grouped[key] = []
    grouped[key].push({ ...e, replacement: e.replacement, checked: e.checked })
  })

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Step 1: Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">选择要脱敏的 Markdown 文件</label>
        <input type="file" accept=".md" onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        {selectedFile && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <DocumentIcon className="h-4 w-4" />
            <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}
      </div>

      {/* Scan button */}
      {selectedFile && fileContent && step === 'upload' && (
        <button type="button" onClick={handleScan}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <MagnifyingGlassIcon className="h-4 w-4" />智能扫描敏感实体
        </button>
      )}

      {/* Scanning indicator */}
      {step === 'scanning' && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          <span className="text-sm text-gray-600">正在使用 NER 模型扫描文档，请稍候...</span>
        </div>
      )}

      {/* Step 2: Confirm entities */}
      {step === 'confirm' && entities.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              发现 {entities.length} 个候选敏感实体，请确认需要脱敏的项目
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => handleToggleAll(true)}
                className="text-xs text-blue-600 hover:underline">全选</button>
              <span className="text-xs text-gray-300">|</span>
              <button onClick={() => handleToggleAll(false)}
                className="text-xs text-blue-600 hover:underline">全不选</button>
            </div>
          </div>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(grouped).map(([label, items]) => (
              <div key={label}>
                <div className="text-xs font-semibold text-gray-500 mb-1 px-1">{label} ({items.length})</div>
                <div className="space-y-1">
                  {items.map((item) => {
                    const realIdx = entities.findIndex(e => e.text === item.text && e.label === item.label)
                    return (
                      <label key={`${item.text}-${item.label}`}
                        className="flex items-center gap-3 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={entities[realIdx]?.checked ?? false}
                          onChange={() => handleToggleEntity(realIdx)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                        <span className="text-sm font-medium text-gray-900 min-w-[80px]">{item.text}</span>
                        <span className="text-xs text-gray-400">×{item.count}</span>
                        <span className="text-xs text-gray-300">→</span>
                        <input type="text" value={entities[realIdx]?.replacement ?? ''}
                          onChange={e => handleReplacementChange(realIdx, e.target.value)}
                          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {entities.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">未发现候选敏感实体</p>
          )}
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && preview && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">脱敏预览 (替换 {matchCount} 处)</label>
            <button onClick={() => setStep('confirm')} className="text-xs text-blue-600 hover:underline">返回修改</button>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md max-h-80 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{preview}</pre>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(step === 'confirm' || step === 'preview') && (
        <div className="flex gap-3">
          {step === 'confirm' && (
            <button type="button" onClick={handlePreview}
              disabled={checkedCount === 0}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              <EyeIcon className="h-4 w-4" />预览脱敏 ({checkedCount} 项)
            </button>
          )}
          {step === 'preview' && (
            <button type="button" onClick={handleExecute}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <PlayIcon className="h-4 w-4" />执行脱敏并保存
            </button>
          )}
          <button type="button" onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50">
            重新开始
          </button>
        </div>
      )}
    </div>
  )
}
