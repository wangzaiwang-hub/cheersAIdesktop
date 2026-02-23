'use client'

import { useState } from 'react'
import {
  DocumentIcon,
  EyeIcon,
  PlayIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
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

interface ManualReplacement {
  find: string
  replace: string
}

function getMaskedFileName(originalName: string): string {
  const dotIdx = originalName.lastIndexOf('.')
  if (dotIdx === -1) return `${originalName}.masked`
  return `${originalName.substring(0, dotIdx)}.masked${originalName.substring(dotIdx)}`
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

  // Apply manual find-replace first (longer strings first)
  const sortedManual = [...manualReplacements]
    .filter(mr => mr.find.length > 0)
    .sort((a, b) => b.find.length - a.find.length)
  for (const mr of sortedManual) {
    const regex = new RegExp(escapeRegex(mr.find), 'g')
    let matchCount = 0
    masked = masked.replace(regex, () => { matchCount++; return mr.replace })
    totalCount += matchCount
  }

  // Then apply NER entity replacements
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.md')) {
      setError('\u76ee\u524d\u4ec5\u652f\u6301 .md (Markdown) \u6587\u4ef6')
      return
    }
    setSelectedFile(file)
    setStep('upload')
    setEntities([])
    setManualReplacements([])
    setPreview('')
    setMaskedContent('')
    const reader = new FileReader()
    reader.onload = (ev) => { setFileContent(ev.target?.result as string ?? '') }
    reader.onerror = () => setError('\u8bfb\u53d6\u6587\u4ef6\u5931\u8d25')
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
      setError(`NER \u626b\u63cf\u5931\u8d25: ${err instanceof Error ? err.message : err}`)
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

  // Manual replacement handlers
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
      setError('\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u5b9e\u4f53\u6216\u6dfb\u52a0\u4e00\u6761\u66ff\u6362\u89c4\u5219')
      return
    }
    const { masked, count } = applyEntityMasking(fileContent, entities, manualReplacements)
    setMaskedContent(masked)
    setMatchCount(count)
    setPreview(masked.length > 3000 ? masked.substring(0, 3000) + '\n\n... (\u5df2\u622a\u65ad)' : masked)
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
        messages.push(`\u5df2\u4fdd\u5b58\u5230 ${result.file_path}`)
      }
      catch (saveErr) {
        messages.push(`\u4fdd\u5b58\u5931\u8d25: ${saveErr instanceof Error ? saveErr.message : saveErr}`)
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
      messages.push('\u6d4f\u89c8\u5668\u4e0b\u8f7d\u5df2\u89e6\u53d1')
    }
    catch {
      messages.push('\u6d4f\u89c8\u5668\u4e0b\u8f7d\u5931\u8d25')
    }

    const hasError = messages.some(m => m.includes('\u5931\u8d25'))
    if (hasError)
      setError(messages.join('\uff1b'))
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
  }

  if (step === 'done') {
    return (
      <div className="text-center py-12">
        <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">{'\u8131\u654f\u5b8c\u6210'}</h3>
        <p className="mt-1 text-sm text-gray-500">{'\u5df2\u66ff\u6362'} {matchCount} {'\u5904\u654f\u611f\u6570\u636e'}</p>
        <p className="mt-1 text-xs text-gray-400">
          {'\u6587\u4ef6'}: {selectedFile ? getMaskedFileName(selectedFile.name) : ''} {'\u2192'} {sandboxPath}
        </p>
        <button onClick={handleReset}
          className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          {'\u8131\u654f\u5176\u4ed6\u6587\u4ef6'}
        </button>
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

      {/* Step 1: Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{'\u9009\u62e9\u8981\u8131\u654f\u7684 Markdown \u6587\u4ef6'}</label>
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
          <MagnifyingGlassIcon className="h-4 w-4" />{'\u667a\u80fd\u626b\u63cf\u654f\u611f\u5b9e\u4f53'}
        </button>
      )}

      {/* Scanning indicator */}
      {step === 'scanning' && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          <span className="text-sm text-gray-600">{'\u6b63\u5728\u4f7f\u7528 NER \u6a21\u578b\u626b\u63cf\u6587\u6863\uff0c\u8bf7\u7a0d\u5019...'}</span>
        </div>
      )}

      {/* Step 2: Confirm entities */}
      {step === 'confirm' && (
        <>
          {entities.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  {'\u53d1\u73b0'} {entities.length} {'\u4e2a\u5019\u9009\u654f\u611f\u5b9e\u4f53\uff0c\u8bf7\u786e\u8ba4\u9700\u8981\u8131\u654f\u7684\u9879\u76ee'}
                </label>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleAll(true)}
                    className="text-xs text-blue-600 hover:underline">{'\u5168\u9009'}</button>
                  <span className="text-xs text-gray-300">|</span>
                  <button onClick={() => handleToggleAll(false)}
                    className="text-xs text-blue-600 hover:underline">{'\u5168\u4e0d\u9009'}</button>
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
                            <span className="text-xs text-gray-400">{'\u00d7'}{item.count}</span>
                            <span className="text-xs text-gray-300">{'\u2192'}</span>
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
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">{'\u624b\u52a8\u67e5\u627e\u66ff\u6362'}</label>
              <button type="button" onClick={handleAddManualReplacement}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <PlusIcon className="h-3.5 w-3.5" />{'\u6dfb\u52a0'}
              </button>
            </div>
            {manualReplacements.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">{'\u70b9\u51fb\u201c\u6dfb\u52a0\u201d\u6309\u94ae\u6dfb\u52a0\u81ea\u5b9a\u4e49\u67e5\u627e\u66ff\u6362\u89c4\u5219\uff0c\u7c7b\u4f3c Ctrl+H'}</p>
            ) : (
              <div className="space-y-2">
                {manualReplacements.map((mr, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="text" value={mr.find} placeholder={'\u67e5\u627e\u5185\u5bb9'}
                      onChange={e => handleManualFindChange(idx, e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                    <span className="text-xs text-gray-300">{'\u2192'}</span>
                    <input type="text" value={mr.replace} placeholder={'\u66ff\u6362\u4e3a'}
                      onChange={e => handleManualReplaceChange(idx, e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                    {fileContent && mr.find && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {fileContent.split(mr.find).length - 1}{'\u5904'}
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
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">{'\u8131\u654f\u9884\u89c8'} ({'\u66ff\u6362'} {matchCount} {'\u5904'})</label>
            <button onClick={() => setStep('confirm')} className="text-xs text-blue-600 hover:underline">{'\u8fd4\u56de\u4fee\u6539'}</button>
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
              disabled={checkedCount === 0 && validManualCount === 0}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              <EyeIcon className="h-4 w-4" />{'\u9884\u89c8\u8131\u654f'} ({checkedCount + validManualCount} {'\u9879'})
            </button>
          )}
          {step === 'preview' && (
            <button type="button" onClick={handleExecute}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <PlayIcon className="h-4 w-4" />{'\u6267\u884c\u8131\u654f\u5e76\u4fdd\u5b58'}
            </button>
          )}
          <button type="button" onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50">
            {'\u91cd\u65b0\u5f00\u59cb'}
          </button>
        </div>
      )}
    </div>
  )
}