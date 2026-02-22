'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DocumentIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ClockIcon,
  EyeIcon,
  FolderOpenIcon,
} from '@heroicons/react/24/outline'
import {
  isTauri,
  listSandboxFiles,
  readFileFromSandbox,
  deleteSandboxFile,
} from '@/lib/data-masking/tauri-fs'
import type { LocalFileInfo } from '@/lib/data-masking/tauri-fs'

interface FileRecord {
  id: string
  fileName: string
  content: string
  fullPath: string
  size: number
  createdAt: string
  source: 'local' | 'indexeddb'
}

interface FileListProps {
  sandboxPath: string
  onRefresh?: () => void
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('data-masking-db', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('masked_files'))
        db.createObjectStore('masked_files', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function FileList({ sandboxPath }: FileListProps) {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [useTauriFs, setUseTauriFs] = useState(false)

  useEffect(() => {
    setUseTauriFs(isTauri())
  }, [])

  const loadFromTauri = useCallback(async (): Promise<FileRecord[]> => {
    if (!sandboxPath) return []
    const localFiles: LocalFileInfo[] = await listSandboxFiles(sandboxPath)
    return localFiles.map((f) => ({
      id: f.name,
      fileName: f.name,
      content: '',
      fullPath: sandboxPath.replace(/[\\/]+$/, '') + '/' + f.name,
      size: f.size,
      createdAt: f.created_at || new Date().toISOString(),
      source: 'local' as const,
    }))
  }, [sandboxPath])

  const loadFromIndexedDB = useCallback(async (): Promise<FileRecord[]> => {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('masked_files', 'readonly')
      const req = tx.objectStore('masked_files').getAll()
      req.onsuccess = () => {
        const records = (req.result || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          fileName: r.fileName as string,
          content: r.content as string,
          fullPath: '',
          size: typeof r.content === 'string' ? new Blob([r.content as string]).size : 0,
          createdAt: r.createdAt as string,
          source: 'indexeddb' as const,
        }))
        resolve(records)
      }
      req.onerror = () => resolve([])
      tx.oncomplete = () => db.close()
    })
  }, [])

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const records = useTauriFs && sandboxPath
        ? await loadFromTauri()
        : await loadFromIndexedDB()
      records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setFiles(records)
    }
    catch (err) {
      console.error('Failed to load files:', err)
    }
    finally {
      setIsLoading(false)
    }
  }, [useTauriFs, sandboxPath, loadFromTauri, loadFromIndexedDB])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handlePreview = async (file: FileRecord) => {
    if (previewFile?.id === file.id) {
      setPreviewFile(null)
      setPreviewContent('')
      return
    }
    setPreviewFile(file)
    if (file.source === 'local') {
      try {
        const content = await readFileFromSandbox(file.fullPath)
        setPreviewContent(content.length > 3000 ? content.substring(0, 3000) + '\n\n... (truncated)' : content)
      }
      catch {
        setPreviewContent('Failed to read file')
      }
    }
    else {
      setPreviewContent(file.content.length > 3000 ? file.content.substring(0, 3000) + '\n\n... (truncated)' : file.content)
    }
  }

  const handleDownload = async (file: FileRecord) => {
    let content = file.content
    if (file.source === 'local') {
      try {
        content = await readFileFromSandbox(file.fullPath)
      }
      catch {
        alert('Failed to read file')
        return
      }
    }
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (file: FileRecord) => {
    if (!confirm('Are you sure you want to delete ' + file.fileName + '?')) return
    try {
      if (file.source === 'local') {
        await deleteSandboxFile(file.fullPath)
      }
      else {
        const db = await openDB()
        const tx = db.transaction('masked_files', 'readwrite')
        tx.objectStore('masked_files').delete(file.id)
        await new Promise<void>((res) => {
          tx.oncomplete = () => {
            db.close()
            res()
          }
        })
      }
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
      if (previewFile?.id === file.id) {
        setPreviewFile(null)
        setPreviewContent('')
      }
    }
    catch {
      alert('Failed to delete')
    }
  }

  const formatDate = (iso: string) => {
    if (!iso) return '-'
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading files...</div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No masked files yet</h3>
        <p className="mt-1 text-sm text-gray-500">Mask some files to see them here</p>
        {useTauriFs && sandboxPath && (
          <p className="mt-2 text-xs text-gray-400 flex items-center justify-center gap-1">
            <FolderOpenIcon className="h-3.5 w-3.5" />
            Local path: {sandboxPath}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Total: {files.length} files</span>
          {useTauriFs && sandboxPath && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <FolderOpenIcon className="h-3.5 w-3.5" />
              {sandboxPath}
            </span>
          )}
        </div>
        <button onClick={loadFiles} className="text-sm text-blue-600 hover:text-blue-800">
          Refresh
        </button>
      </div>
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">File Name</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Size</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created</th>
              <th className="relative py-3.5 pl-3 pr-4 text-right text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {files.map((file) => (
              <tr key={file.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                  <div className="flex items-center gap-2">
                    <DocumentIcon className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-900">{file.fileName}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatSize(file.size)}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    {formatDate(file.createdAt)}
                  </div>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handlePreview(file)} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900">
                      <EyeIcon className="h-4 w-4" />Preview
                    </button>
                    <button onClick={() => handleDownload(file)} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900">
                      <ArrowDownTrayIcon className="h-4 w-4" />Download
                    </button>
                    <button onClick={() => handleDelete(file)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-900">
                      <TrashIcon className="h-4 w-4" />Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {previewFile && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">{previewFile.fileName}</span>
            <button
              onClick={() => { setPreviewFile(null); setPreviewContent(''); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{previewContent}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
