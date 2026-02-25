'use client'

import { useState, useRef, useCallback } from 'react'
import {
  DocumentIcon,
  EyeIcon,
  PlayIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { saveSandboxFile, scanEntities, extractTextFromFile } from '@/service/sandbox-files'
import type { NerEntity } from '@/service/sandbox-files'

// Text-based formats readable in browser
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json', '.xml', '.yaml', '.yml', '.log', '.conf', '.ini', '.toml', '.html', '.htm', '.css', '.js', '.ts', '.py', '.java', '.sql', '.sh', '.bat'])
// Binary formats requiring backend extraction
const BINARY_EXTENSIONS = new Set(['.docx', '.pdf'])
const ALL_EXTENSIONS = [...TEXT_EXTENSIONS, ...BINARY_EXTENSIONS]
const ACCEPT_STRING = ALL_EXTENSIONS.join(',')
interface FileMaskingProps {
  sandboxPath: string
}

interface ConfirmableEntity extends NerEntity {
  checked: boolean
  replacement: string
}

interface ManualReplacement {
  find: string
  replace: string
}

function getMaskedFileName(originalName: string): string {
  const dotIdx = originalName.lastIndexOf('.')
  if (dotIdx === -1) return `${originalName}.masked.txt`
  const ext = originalName.substring(dotIdx)
  const base = originalName.substring(0, dotIdx)
  // Binary formats get .masked.txt since we output plain text
  if (BINARY_EXTENSIONS.has(ext.toLowerCase()))
    return `${base}.masked.txt`
  return `${base}.masked${ext}`
}

function getFileExtension(name: string): string {
  const dotIdx = name.lastIndexOf('.')
  return dotIdx === -1 ? '' : name.substring(dotIdx).toLowerCase()
}

function isSupportedFile(name: string): boolean {
  const ext = getFileExtension(name)
  return TEXT_EXTENSIONS.has(ext) || BINARY_EXTENSIONS.has(ext)
}

function isBinaryFile(name: string): boolean {
  return BINARY_EXTENSIONS.has(getFileExtension(name))
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyEntityMasking(
  content: string,
  entities: ConfirmableEntity[],
  manualReplacements: ManualReplacement[],
): { masked: string; count: number } {
  let masked = content
  let totalCount = 0

  const sortedManual = [...manualReplacements]
    .filter(mr => mr.find.length > 0)
    .sort((a, b) => b.find.length - a.find.length)
  for (const mr of sortedManual) {
    const regex = new RegExp(escapeRegex(mr.find), 'g')
    let matchCount = 0
    masked = masked.replace(regex, () => { matchCount++; return mr.replace })
    totalCount += matchCount
  }

  const sorted = [...entities]
    .filter(e => e.checked)
    .sort((a, b) => b.text.length - a.text.length)
  for (const entity of sorted) {
    const regex = new RegExp(escapeRegex(entity.text), 'g')
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
  const [manualReplacements, setManualReplacements] = useState<ManualReplacement[]>([])
  const [preview, setPreview] = useState('')
  const [maskedContent, setMaskedContent] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const processFile = useCallback((file: File) => {
    setError('')
    if (!isSupportedFile(file.name)) {
      setError(`不支持的文件格式。支持: ${ALL_EXTENSIONS.join(', ')}`)
      return
    }
    setSelectedFile(file)
    setStep('upload')
    setEntities([])
    setManualReplacements([])
    setPreview('')
    setMaskedContent('')

    if (isBinaryFile(file.name)) {
      // Binary files: extract text via backend
      setFileContent('')
      setExtracting(true)
      extractTextFromFile(file)
        .then((result) => {
          setFileContent(result.content)
          setExtracting(false)
        })
        .catch((err) => {
          setError(`文件解析失败: ${err instanceof Error ? err.message : err}`)
          setSelectedFile(null)
          setExtracting(false)
        })
    }
    else {
      // Text files: read directly in browser
      const reader = new FileReader()
      reader.onload = (ev) => { setFileContent(ev.target?.result as string ?? '') }
      reader.onerror = () => setError('读取文件失败')
      reader.readAsText(file)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

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

  const handleAddManualReplacement = () => {
    setManualReplacements(prev => [...prev, { find: '', replace: '' }])
  }

  const handleRemoveManualReplacement = (idx: number) => {
    setManualReplacements(prev => prev.filter((_, i) => i !== idx))
  }

  const handleManualFindChange = (idx: number, value: string) => {
    setManualReplacements(prev => prev.map((mr, i) => i === idx ? { ...mr, find: value } : mr))
  }

  const handleManualReplaceChange = (idx: number, value: string) => {
    setManualReplacements(prev => prev.map((mr, i) => i === idx ? { ...mr, replace: value } : mr))
  }

  const handlePreview = () => {
    const checkedEntities = entities.filter(e => e.checked)
    const validManual = manualReplacements.filter(mr => mr.find.length > 0)
    if (checkedEntities.length === 0 && validManual.length === 0) {
      setError('请至少选择一个实体或添加一条替换规则')
      return
    }
    const { masked, count } = applyEntityMasking(fileContent, entities, manualReplacements)
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
    setManualReplacements([])
    setPreview('')
    setMaskedContent('')
    setMatchCount(0)
    setStep('upload')
    setError('')
    setExtracting(false)
  }

  // Done state
  if (step === 'done') {
    return (
      <div className="text-center py-16">
        <CheckCircleIcon className="mx-auto h-14 w-14 text-green-500" />
        <h3 className="mt-3 text-base font-medium text-gray-900">脱敏完成</h3>
        <p className="mt-1 text-sm text-gray-500">已替换 {matchCount} 处敏感数据</p>
        <p className="mt-1 text-xs text-gray-400">
          文件: {selectedFile ? getMaskedFileName(selectedFile.name) : ''} → {sandboxPath}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={handleReset}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            继续脱敏其他文件
          </button>
          <a href="/data-masking?tab=files"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            查看文件管理
          </a>
        </div>
      </div>
    )
  }

  const checkedCount = entities.filter(e => e.checked).length
  const validManualCount = manualReplacements.filter(mr => mr.find.length > 0).length

  const grouped: Record<string, ConfirmableEntity[]> = {}
  entities.forEach((e) => {
    const key = e.label
    if (!grouped[key]) grouped[key] = []
    grouped[key].push({ ...e })
  })

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Stats cards - show when no file selected */}
      {step === 'upload' && !selectedFile && (
        <div className="grid grid-cols-3 gap-4 mb-2">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <DocumentTextIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">支持格式</p>
                <p className="text-sm font-medium text-gray-900">MD / TXT / Word / PDF 等</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <ShieldCheckIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">脱敏方式</p>
                <p className="text-sm font-medium text-gray-900">NER + 手动替换</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <ClockIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">处理方式</p>
                <p className="text-sm font-medium text-gray-900">本地处理，不上传</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drag & drop upload area */}
      {step === 'upload' && (
        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : selectedFile
                ? 'border-green-300 bg-green-50/50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
          } ${selectedFile ? 'p-5' : 'p-10'}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_STRING}
            onChange={handleFileSelect}
            className="hidden"
          />
          {selectedFile ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <DocumentIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                    {extracting ? ' · 正在解析文件内容...' : fileContent ? ` · ${fileContent.length} 字符` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReset() }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                >
                  重新选择
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleScan() }}
                  disabled={extracting || !fileContent}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {extracting
                    ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>解析中...</>
                    : <><MagnifyingGlassIcon className="h-4 w-4" />智能扫描</>
                  }
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <ArrowUpTrayIcon className={`mx-auto h-10 w-10 ${dragging ? 'text-blue-500' : 'text-gray-300'}`} />
              <p className="mt-3 text-sm font-medium text-gray-700">
                {dragging ? '松开鼠标上传文件' : '拖拽文件到此处上传'}
              </p>
              <p className="mt-1 text-xs text-gray-400">或点击此区域选择文件 · 支持 Markdown、TXT、Word、PDF 等格式</p>
            </div>
          )}
        </div>
      )}

      {/* Scanning indicator */}
      {step === 'scanning' && (
        <div className="flex flex-col items-center gap-3 py-12 bg-white rounded-xl border border-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">正在使用 NER 模型扫描文档，请稍候...</span>
          <span className="text-xs text-gray-400">{selectedFile?.name}</span>
        </div>
      )}

      {/* Step 2: Confirm entities */}
      {step === 'confirm' && (
        <>
          {/* File info bar */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <DocumentIcon className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{selectedFile?.name}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-400">{(selectedFile?.size ?? 0 / 1024).toFixed(1)} KB</span>
            </div>
            <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-700">重新选择文件</button>
          </div>

          {entities.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="h-4 w-4 text-blue-600" />
                  <label className="text-sm font-medium text-gray-700">
                    发现 {entities.length} 个候选敏感实体
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleAll(true)}
                    className="text-xs text-blue-600 hover:underline">全选</button>
                  <span className="text-xs text-gray-300">|</span>
                  <button onClick={() => handleToggleAll(false)}
                    className="text-xs text-blue-600 hover:underline">全不选</button>
                </div>
              </div>
              <div className="space-y-4 max-h-72 overflow-y-auto">
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
                              onClick={e => e.stopPropagation()}
                              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Find & Replace */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">手动查找替换</label>
              </div>
              <button type="button" onClick={handleAddManualReplacement}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <PlusIcon className="h-3.5 w-3.5" />添加
              </button>
            </div>
            {manualReplacements.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">点击"添加"按钮添加自定义查找替换规则，类似 Ctrl+H</p>
            ) : (
              <div className="space-y-2">
                {manualReplacements.map((mr, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="text" value={mr.find} placeholder="查找内容"
                      onChange={e => handleManualFindChange(idx, e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                    <span className="text-xs text-gray-300">→</span>
                    <input type="text" value={mr.replace} placeholder="替换为"
                      onChange={e => handleManualReplaceChange(idx, e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                    {fileContent && mr.find && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {fileContent.split(mr.find).length - 1}处
                      </span>
                    )}
                    <button type="button" onClick={() => handleRemoveManualReplacement(idx)}
                      className="text-gray-400 hover:text-red-500">
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Preview */}
      {step === 'preview' && preview && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <EyeIcon className="h-4 w-4 text-blue-600" />
              <label className="text-sm font-medium text-gray-700">脱敏预览 (替换 {matchCount} 处)</label>
            </div>
            <button onClick={() => setStep('confirm')} className="text-xs text-blue-600 hover:underline">返回修改</button>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{preview}</pre>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(step === 'confirm' || step === 'preview') && (
        <div className="flex gap-3">
          {step === 'confirm' && (
            <button type="button" onClick={handlePreview}
              disabled={checkedCount === 0 && validManualCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <EyeIcon className="h-4 w-4" />预览脱敏 ({checkedCount + validManualCount} 项)
            </button>
          )}
          {step === 'preview' && (
            <button type="button" onClick={handleExecute}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
              <PlayIcon className="h-4 w-4" />执行脱敏并保存
            </button>
          )}
          <button type="button" onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50">
            重新开始
          </button>
        </div>
      )}

      {/* Usage tips - show when no file selected */}
      {step === 'upload' && !selectedFile && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h4 className="text-sm font-medium text-gray-700 mb-3">使用说明</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-medium">1</span>
              <p className="text-xs text-gray-500">上传或拖拽文件到上方区域（支持多种格式）</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-medium">2</span>
              <p className="text-xs text-gray-500">点击「智能扫描」自动识别敏感实体</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-medium">3</span>
              <p className="text-xs text-gray-500">确认需要脱敏的实体，可自定义替换文本</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-medium">4</span>
              <p className="text-xs text-gray-500">预览后执行，脱敏文件自动保存到沙箱</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
