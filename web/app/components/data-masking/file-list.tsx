'use client'

import { useState, useEffect } from 'react'
import { DocumentIcon, CloudArrowUpIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline'

interface FileInfo {
  id: string
  name: string
  size: number
  created: Date
}

interface FileListProps {
  sandboxPath: string
  onRefresh?: () => void
}

export function FileList({ sandboxPath, onRefresh }: FileListProps) {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    loadFiles()
  }, [sandboxPath])

  const loadFiles = async () => {
    setIsLoading(true)
    try {
      // Simulate loading files
      await new Promise(resolve => setTimeout(resolve, 500))
      setFiles([])
    }
    catch (err) {
      console.error('Failed to load files:', err)
    }
    finally {
      setIsLoading(false)
    }
  }

  const handleUpload = async (fileId: string) => {
    setIsUploading(true)
    try {
      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert('上传成功')
    }
    catch (err) {
      alert('上传失败')
    }
    finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`确定要删除 ${fileName} 吗？`))
      return

    try {
      // Simulate delete
      await new Promise(resolve => setTimeout(resolve, 500))
      setFiles(prev => prev.filter(f => f.id !== fileId))
    }
    catch (err) {
      alert('删除失败')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024)
      return `${bytes} B`
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">加载文件中...</div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">暂无脱敏文件</h3>
        <p className="mt-1 text-sm text-gray-500">
          脱敏一些文件后将在此显示
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                文件名
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                大小
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                创建时间
              </th>
              <th className="relative py-3.5 pl-3 pr-4 text-right text-sm font-semibold text-gray-900">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {files.map(file => (
              <tr key={file.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                  <div className="flex items-center gap-2">
                    <DocumentIcon className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-900">{file.name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatFileSize(file.size)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    {formatDate(file.created)}
                  </div>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleUpload(file.id)}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 disabled:opacity-50"
                    >
                      <CloudArrowUpIcon className="h-4 w-4" />
                      {isUploading ? '上传中...' : '上传'}
                    </button>
                    <button
                      onClick={() => handleDelete(file.id, file.name)}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-4 w-4" />
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
