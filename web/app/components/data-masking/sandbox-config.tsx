'use client'

import { useState, useEffect } from 'react'
import { FolderIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { SandboxManager } from '@/lib/data-masking/sandbox-manager'

interface SandboxConfigProps {
  onConfigured?: (path: string) => void
}

export function SandboxConfig({ onConfigured }: SandboxConfigProps) {
  const [sandboxPath, setSandboxPath] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string>('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const [sandboxManager] = useState(() => new SandboxManager())

  // Load current sandbox configuration on mount
  useEffect(() => {
    loadCurrentConfig()
  }, [])

  const loadCurrentConfig = async () => {
    try {
      await sandboxManager.initialize()
      const path = sandboxManager.getSandboxPath()
      if (path) {
        setCurrentPath(path)
        setSandboxPath(path)
        setIsValid(true)
      }
    }
    catch (err) {
      console.error('Failed to load sandbox config:', err)
    }
  }

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSandboxPath(e.target.value)
    setIsValid(null)
    setError('')
  }

  const handleSelectDirectory = async () => {
    try {
      // Use browser's directory picker API
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker()
        const path = dirHandle.name // This is simplified, actual implementation needs full path
        setSandboxPath(path)
        setIsValid(null)
        setError('')
      }
      else {
        setError('浏览器不支持目录选择功能')
      }
    }
    catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('选择目录失败')
      }
    }
  }

  const handleValidate = async () => {
    if (!sandboxPath.trim()) {
      setError('请输入沙箱路径')
      setIsValid(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await sandboxManager.initialize()
      const result = await sandboxManager.configureSandbox(sandboxPath)
      if (result.success) {
        setIsValid(true)
        setCurrentPath(sandboxPath)
        setError('')
        onConfigured?.(sandboxPath)
      }
      else {
        setIsValid(false)
        setError(result.error || '无效的沙箱路径')
      }
    }
    catch (err: any) {
      setIsValid(false)
      setError(err.message || '无效的沙箱路径')
    }
    finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setSandboxPath(currentPath)
    setIsValid(currentPath ? true : null)
    setError('')
  }

  return (
    <div className="space-y-6">
      {/* Current Configuration */}
      {currentPath && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">
                当前沙箱路径
              </h3>
              <p className="mt-1 text-sm text-gray-600 font-mono break-all">
                {currentPath}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="space-y-4">
        <div>
          <label htmlFor="sandbox-path" className="block text-sm font-medium text-gray-700 mb-2">
            沙箱目录路径
          </label>
          <div className="flex gap-2">
            <input
              id="sandbox-path"
              type="text"
              value={sandboxPath}
              onChange={handlePathChange}
              placeholder="/path/to/sandbox/directory"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSelectDirectory}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <FolderIcon className="h-4 w-4" />
              浏览
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            所有脱敏文件将存储在此目录中
          </p>
        </div>

        {/* Validation Status */}
        {isValid !== null && (
          <div className={`rounded-md p-3 ${isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start gap-2">
              {isValid ? (
                <>
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">
                      有效的沙箱路径
                    </p>
                    <p className="mt-1 text-xs text-green-700">
                      该目录可访问且可写
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircleIcon className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">
                      无效的沙箱路径
                    </p>
                    {error && (
                      <p className="mt-1 text-xs text-red-700">
                        {error}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleValidate}
            disabled={isLoading || !sandboxPath.trim()}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '验证中...' : '验证并保存'}
          </button>
          {sandboxPath !== currentPath && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              重置
            </button>
          )}
        </div>
      </div>

      {/* Help Text */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          关于沙箱目录
        </h4>
        <ul className="space-y-1 text-xs text-blue-800">
          <li>• 所有脱敏文件将存储在此目录中</li>
          <li>• 映射数据将加密并本地存储</li>
          <li>• 只有此目录内的文件可以上传到 Dify</li>
          <li>• 选择一个有足够存储空间的位置</li>
        </ul>
      </div>
    </div>
  )
}
