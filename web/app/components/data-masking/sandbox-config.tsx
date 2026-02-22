'use client'

import { useState, useEffect } from 'react'
import { FolderIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface SandboxConfigProps {
  onConfigured?: (path: string, dirHandle?: FileSystemDirectoryHandle) => void
}

// Store the directory handle globally so other components can access it
let _dirHandle: FileSystemDirectoryHandle | null = null
export function getDirHandle(): FileSystemDirectoryHandle | null {
  return _dirHandle
}

export function SandboxConfig({ onConfigured }: SandboxConfigProps) {
  const [sandboxPath, setSandboxPath] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string>('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [useBrowserDir, setUseBrowserDir] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sandbox_path')
    if (saved) {
      setCurrentPath(saved)
      setSandboxPath(saved)
      // If it was a browser-dir path, the handle is lost on refresh
      if (saved.startsWith('[浏览器目录]')) {
        setIsValid(null)
        setUseBrowserDir(true)
        setError('页面刷新后浏览器目录句柄已失效，请重新点击「浏览」选择目录')
      }
      else {
        setIsValid(true)
      }
    }
  }, [])

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSandboxPath(e.target.value)
    setIsValid(null)
    setError('')
    setUseBrowserDir(false)
    _dirHandle = null
  }

  const handleSelectDirectory = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        setError('浏览器不支持目录选择，请手动输入完整路径')
        return
      }
      const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
      _dirHandle = handle
      // Verify we can write by creating and removing a test file
      const testFile = await handle.getFileHandle('.sandbox-test', { create: true })
      const writable = await (testFile as unknown as { createWritable: () => Promise<WritableStream> }).createWritable()
      await writable.close()
      await handle.removeEntry('.sandbox-test')

      const displayName = `[浏览器目录] ${handle.name}`
      setSandboxPath(displayName)
      setUseBrowserDir(true)
      setIsValid(true)
      setCurrentPath(displayName)
      setError('')
      localStorage.setItem('sandbox_path', displayName)
      localStorage.setItem('sandbox_use_browser_dir', 'true')
      onConfigured?.(displayName, handle)
    }
    catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('选择目录失败')
    }
  }

  const handleValidate = async () => {
    const trimmed = sandboxPath.trim()
    if (!trimmed) {
      setError('请输入沙箱路径')
      setIsValid(false)
      return
    }

    // If using browser directory handle, already validated
    if (useBrowserDir && _dirHandle) {
      setIsValid(true)
      setCurrentPath(trimmed)
      localStorage.setItem('sandbox_path', trimmed)
      localStorage.setItem('sandbox_use_browser_dir', 'true')
      onConfigured?.(trimmed, _dirHandle)
      return
    }

    // For manual path input, must be absolute
    const isAbsolute = /^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\\\')
    if (!isAbsolute) {
      setError('请输入完整的绝对路径，例如 C:\\Users\\用户名\\Documents\\masked-files')
      setIsValid(false)
      return
    }

    setIsLoading(true)
    setError('')
    try {
      // Test by calling the backend to list files (will create dir if needed)
      const res = await fetch(`http://localhost:5001/console/api/data-masking/sandbox/files/list?sandbox_path=${encodeURIComponent(trimmed)}`)
      if (res.ok) {
        setIsValid(true)
        setCurrentPath(trimmed)
        localStorage.setItem('sandbox_path', trimmed)
        localStorage.removeItem('sandbox_use_browser_dir')
        _dirHandle = null
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
      setError('无法连接后端服务，请确认 Flask 后端已启动')
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
            沙箱目录路径
          </label>
          <div className="flex gap-2">
            <input
              id="sandbox-path"
              type="text"
              value={sandboxPath}
              onChange={handlePathChange}
              placeholder="C:\Users\用户名\Documents\masked-files"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button type="button" onClick={handleSelectDirectory}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FolderIcon className="h-4 w-4" />浏览
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            点击「浏览」选择目录（文件直接写入），或手动输入完整绝对路径（通过后端写入）
          </p>
        </div>

        {isValid !== null && (
          <div className={`rounded-md p-3 ${isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start gap-2">
              {isValid ? (
                <>
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">有效的沙箱路径</p>
                    <p className="mt-1 text-xs text-green-700">
                      {useBrowserDir ? '使用浏览器文件系统 API 直接写入' : '通过后端 API 写入'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircleIcon className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">无效的沙箱路径</p>
                    {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={handleValidate} disabled={isLoading || !sandboxPath.trim()}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? '验证中...' : '验证并保存'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">使用说明</h4>
        <ul className="space-y-1 text-xs text-blue-800">
          <li>• 推荐使用「浏览」按钮选择目录，文件会直接写入你选择的位置</li>
          <li>• 也可以手动输入完整路径（如 C:\Users\xxx\Desktop\masked），通过后端写入</li>
          <li>• 浏览器选择的目录在页面刷新后需要重新选择（浏览器安全限制）</li>
        </ul>
      </div>
    </div>
  )
}
