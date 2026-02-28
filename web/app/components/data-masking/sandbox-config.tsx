'use client'

import { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useSandboxSecurity } from '@/context/sandbox-security-context'

interface SandboxConfigProps {
  onConfigured?: (path: string) => void
}

export function SandboxConfig({ onConfigured }: SandboxConfigProps) {
  const { enabled: securityEnabled, setEnabled: setSecurityEnabled, setSandboxPath: setContextSandboxPath } = useSandboxSecurity()
  const [sandboxPath, setSandboxPath] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string>('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiReplyDownloadPath, setAiReplyDownloadPath] = useState('')
  const [aiReplyDownloadPathSaved, setAiReplyDownloadPathSaved] = useState(false)
  const [sensitiveWarning, setSensitiveWarning] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('sandbox_path')
    if (saved && !saved.startsWith('[')) {
      setCurrentPath(saved)
      setSandboxPath(saved)
      setIsValid(true)
      onConfigured?.(saved)
    }
    const savedAiPath = localStorage.getItem('ai_reply_download_path')
    if (savedAiPath)
      setAiReplyDownloadPath(savedAiPath)
    const savedWarning = localStorage.getItem('sensitive_send_warning')
    if (savedWarning !== null)
      setSensitiveWarning(savedWarning !== 'false')
  }, [])

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSandboxPath(e.target.value)
    setIsValid(null)
    setError('')
  }

  const handleValidate = async () => {
    const trimmed = sandboxPath.trim()
    if (!trimmed) {
      setError('请输入沙箱路径')
      setIsValid(false)
      return
    }
    const isAbsolute = /^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\\\')
    if (!isAbsolute) {
      setError('请输入完整的绝对路径，例如 C:\\Users\\用户名\\Desktop\\masked-files')
      setIsValid(false)
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(
        `http://localhost:5001/console/api/data-masking/sandbox/files/list?sandbox_path=${encodeURIComponent(trimmed)}`,
      )
      if (res.ok) {
        setIsValid(true)
        setCurrentPath(trimmed)
        setContextSandboxPath(trimmed)
        onConfigured?.(trimmed)
      }
      else {
        const data = await res.json().catch(() => ({}))
        setIsValid(false)
        setError(data.error || '路径验证失败')
      }
    }
    catch {
      setIsValid(false)
      setError('无法连接后端服务，请确认 Flask 后端已启动（端口 5001）')
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Security mode toggle */}
      <div className="rounded-lg border border-divider-regular bg-components-panel-bg p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-text-primary">沙箱安全模式</h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              开启后，系统其他模块（知识库、工作流等）的文件上传仅限从沙箱目录选择脱敏后的文件
            </p>
          </div>
          <button
            onClick={() => setSecurityEnabled(!securityEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              securityEnabled ? 'bg-components-button-primary-bg' : 'bg-components-input-bg-normal'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                securityEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {securityEnabled && !currentPath && (
          <div className="mt-3 rounded-md bg-state-warning-hover border border-state-warning-hover-alt px-3 py-2">
            <p className="text-xs text-text-warning">⚠️ 安全模式已开启，但尚未配置沙箱路径。请先在下方配置沙箱目录。</p>
          </div>
        )}
      </div>

      {/* Sensitive data send warning toggle */}
      <div className="rounded-lg border border-divider-regular bg-components-panel-bg p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-text-primary">发送敏感信息提醒</h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              开启后，在聊天中发送文本或文件前会弹出确认提示，提醒确认内容无敏感信息
            </p>
          </div>
          <button
            onClick={() => {
              const next = !sensitiveWarning
              setSensitiveWarning(next)
              localStorage.setItem('sensitive_send_warning', String(next))
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              sensitiveWarning ? 'bg-components-button-primary-bg' : 'bg-components-input-bg-normal'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                sensitiveWarning ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {currentPath && (
        <div className="rounded-lg border border-divider-regular bg-background-section p-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-text-success mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text-primary">当前沙箱路径</h3>
              <p className="mt-1 text-sm text-text-secondary font-mono break-all">{currentPath}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="sandbox-path" className="block text-sm font-medium text-text-secondary mb-2">
            沙箱目录路径（绝对路径）
          </label>
          <input
            id="sandbox-path"
            type="text"
            value={sandboxPath}
            onChange={handlePathChange}
            onKeyDown={e => e.key === 'Enter' && handleValidate()}
            placeholder="C:\Users\33814\Desktop\report\test"
            className="w-full rounded-md border border-components-input-border-active bg-components-input-bg-normal px-3 py-2 text-sm text-text-primary placeholder:text-text-placeholder focus:border-components-input-border-active focus:outline-none focus:ring-1 focus:ring-state-accent-solid"
          />
          <p className="mt-2 text-xs text-text-tertiary">
            输入完整的绝对路径，脱敏后的文件将通过后端 API 保存到该目录
          </p>
        </div>

        {isValid !== null && (
          <div className={`rounded-md p-3 ${isValid ? 'bg-state-success-hover border border-state-success-hover-alt' : 'bg-state-destructive-hover border border-state-destructive-border'}`}>
            <div className="flex items-start gap-2">
              {isValid ? (
                <>
                  <CheckCircleIcon className="h-5 w-5 text-text-success mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-success">路径有效</p>
                    <p className="mt-1 text-xs text-text-success">脱敏文件将保存到此目录</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircleIcon className="h-5 w-5 text-text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-destructive">路径无效</p>
                    {error && <p className="mt-1 text-xs text-text-destructive">{error}</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <button type="button" onClick={handleValidate} disabled={isLoading || !sandboxPath.trim()}
          className="inline-flex items-center rounded-md bg-components-button-primary-bg px-4 py-2 text-sm font-medium text-components-button-primary-text hover:bg-components-button-primary-bg-hover disabled:opacity-50 disabled:cursor-not-allowed">
          {isLoading ? '验证中...' : '验证并保存'}
        </button>
      </div>

      {/* AI回复下载路径配置 */}
      <div className="rounded-lg border border-divider-regular bg-components-panel-bg p-4">
        <h3 className="text-sm font-medium text-text-primary mb-1">AI 回复下载路径</h3>
        <p className="text-xs text-text-tertiary mb-3">
          点击聊天中的下载按钮时，AI 回复将自动保存为 MD 文件到此路径。留空则使用沙箱路径，都未配置则触发浏览器下载。
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={aiReplyDownloadPath}
            onChange={e => setAiReplyDownloadPath(e.target.value)}
            placeholder={currentPath || '默认使用沙箱路径'}
            className="flex-1 rounded-md border border-components-input-border-active bg-components-input-bg-normal px-3 py-2 text-sm text-text-primary placeholder:text-text-placeholder focus:border-components-input-border-active focus:outline-none focus:ring-1 focus:ring-state-accent-solid"
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = aiReplyDownloadPath.trim()
              localStorage.setItem('ai_reply_download_path', trimmed)
              setAiReplyDownloadPathSaved(true)
              setTimeout(() => setAiReplyDownloadPathSaved(false), 2000)
            }}
            className="inline-flex items-center rounded-md bg-components-button-primary-bg px-3 py-2 text-sm font-medium text-components-button-primary-text hover:bg-components-button-primary-bg-hover"
          >
            {aiReplyDownloadPathSaved ? '已保存 ✓' : '保存'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-divider-subtle bg-state-accent-hover p-4">
        <h4 className="text-sm font-medium text-text-accent mb-2">使用说明</h4>
        <ul className="space-y-1 text-xs text-text-accent">
          <li>• 输入你电脑上的完整路径，如 C:\Users\33814\Desktop\report\test</li>
          <li>• 目录不存在时会自动创建</li>
          <li>• 脱敏后的文件会直接保存到该目录，同时触发浏览器下载</li>
          <li>• 路径保存后刷新页面不会丢失</li>
          <li>• AI 回复下载路径可单独配置，不填则默认使用沙箱路径</li>
        </ul>
      </div>
    </div>
  )
}
