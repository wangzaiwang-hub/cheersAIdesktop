'use client'

import { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface SandboxConfigProps {
  onConfigured?: (path: string) => void
}

export function SandboxConfig({ onConfigured }: SandboxConfigProps) {
  const [sandboxPath, setSandboxPath] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string>('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sandbox_path')
    if (saved && !saved.startsWith('[')) {
      setCurrentPath(saved)
      setSandboxPath(saved)
      setIsValid(true)
      onConfigured?.(saved)
    }
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

    // Must be absolute path
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
        localStorage.setItem('sandbox_path', trimmed)
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
      {currentPath && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">当前沙箱路径</h3>
              <p className="mt-1 text-sm text-gray-600 font-mono break-all">{currentPath}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="sandbox-path" className="block text-sm font-medium text-gray-700 mb-2">
            沙箱目录路径（绝对路径）
          </label>
          <input
            id="sandbox-path"
            type="text"
            value={sandboxPath}
            onChange={handlePathChange}
            onKeyDown={e => e.key === 'Enter' && handleValidate()}
            placeholder="C:\Users\33814\Desktop\report\test"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            输入完整的绝对路径，脱敏后的文件将通过后端 API 保存到该目录
          </p>
        </div>

        {isValid !== null && (
          <div className={`rounded-md p-3 ${isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start gap-2">
              {isValid ? (
                <>
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">路径有效</p>
                    <p className="mt-1 text-xs text-green-700">脱敏文件将保存到此目录</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircleIcon className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">路径无效</p>
                    {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <button type="button" onClick={handleValidate} disabled={isLoading || !sandboxPath.trim()}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {isLoading ? '验证中...' : '验证并保存'}
        </button>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">使用说明</h4>
        <ul className="space-y-1 text-xs text-blue-800">
          <li>• 输入你电脑上的完整路径，如 C:\Users\33814\Desktop\report\test</li>
          <li>• 目录不存在时会自动创建</li>
          <li>• 脱敏后的文件会直接保存到该目录，同时触发浏览器下载</li>
          <li>• 路径保存后刷新页面不会丢失</li>
        </ul>
      </div>
    </div>
  )
}
