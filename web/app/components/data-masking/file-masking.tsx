'use client'

import { useState } from 'react'
import { DocumentIcon, EyeIcon, PlayIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import type { MaskingRule } from '@/lib/data-masking/types'

interface FileMaskingProps {
  rules: MaskingRule[]
  sandboxPath: string
}

export function FileMasking({ rules, sandboxPath }: FileMaskingProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedRules, setSelectedRules] = useState<string[]>([])
  const [preview, setPreview] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreview('')
      setShowSuccess(false)
    }
  }

  const handleRuleToggle = (ruleId: string) => {
    setSelectedRules(prev =>
      prev.includes(ruleId)
        ? prev.filter(id => id !== ruleId)
        : [...prev, ruleId],
    )
  }

  const handlePreview = async () => {
    if (!selectedFile || selectedRules.length === 0)
      return

    setIsProcessing(true)
    try {
      // Simulate preview generation
      await new Promise(resolve => setTimeout(resolve, 1000))
      setPreview('预览内容将在这里显示...')
    }
    finally {
      setIsProcessing(false)
    }
  }

  const handleExecute = async () => {
    if (!selectedFile || selectedRules.length === 0 || !preview)
      return

    setIsProcessing(true)
    try {
      // Simulate masking execution
      await new Promise(resolve => setTimeout(resolve, 1500))
      setShowSuccess(true)
      setTimeout(() => {
        setSelectedFile(null)
        setSelectedRules([])
        setPreview('')
        setShowSuccess(false)
      }, 2000)
    }
    finally {
      setIsProcessing(false)
    }
  }

  if (showSuccess) {
    return (
      <div className="text-center py-12">
        <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">脱敏完成</h3>
        <p className="mt-1 text-sm text-gray-500">
          脱敏文件已保存到沙箱目录
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* File Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择要脱敏的文件
        </label>
        <div className="flex items-center gap-4">
          <input
            type="file"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
        {selectedFile && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <DocumentIcon className="h-4 w-4" />
            <span>{selectedFile.name}</span>
          </div>
        )}
      </div>

      {/* Rule Selection */}
      {selectedFile && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择脱敏规则
          </label>
          {rules.length === 0 ? (
            <p className="text-sm text-gray-500">暂无可用的脱敏规则，请先创建规则</p>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
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
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            预览（前500个字符）
          </label>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
              {preview}
            </pre>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={!selectedFile || selectedRules.length === 0 || isProcessing}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <EyeIcon className="h-4 w-4" />
          {isProcessing ? '生成预览中...' : '预览脱敏'}
        </button>
        <button
          type="button"
          onClick={handleExecute}
          disabled={!preview || isProcessing}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlayIcon className="h-4 w-4" />
          {isProcessing ? '处理中...' : '执行脱敏'}
        </button>
      </div>
    </div>
  )
}
