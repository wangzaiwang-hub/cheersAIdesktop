'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DocumentIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ClockIcon,
  EyeIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import {
  listSandboxFiles as apiListFiles,
  readSandboxFile as apiReadFile,
  deleteSandboxFile as apiDeleteFile,
} from '@/service/sandbox-files'
import { post } from '@/service/base'

interface FileRecord {
  id: string
  fileName: string
  size: number
  createdAt: string
}

interface FileListProps {
  sandboxPath: string
  onRefresh?: () => void
}

type SortField = 'fileName' | 'size' | 'createdAt'
type SortDir = 'asc' | 'desc'

const PAGE_SIZES = [10, 20, 50]

export function FileList({ sandboxPath }: FileListProps) {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const loadFiles = useCallback(async () => {
    if (!sandboxPath) return
    setIsLoading(true)
    setError('')
    try {
      const list = await apiListFiles(sandboxPath)
      setFiles(list.map(f => ({ id: f.name, fileName: f.name, size: f.size, createdAt: f.created_at })))
    }
    catch (err) {
      console.error('Failed to load files:', err)
      setError(`加载文件列表失败: ${err}`)
    }
    finally {
      setIsLoading(false)
    }
  }, [sandboxPath])

  useEffect(() => { loadFiles() }, [loadFiles])
  useEffect(() => { setPage(1) }, [search, sortField, sortDir, pageSize])

  const filtered = useMemo(() => {
    let result = files
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(f => f.fileName.toLowerCase().includes(q))
    }
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortField === 'fileName') {
        cmp = a.fileName.localeCompare(b.fileName, 'zh-CN')
      }
      else if (sortField === 'size') {
        cmp = a.size - b.size
      }
      else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [files, search, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    }
    else {
      setSortField(field)
      setSortDir(field === 'fileName' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDownIcon className="h-3 w-3 text-gray-300" />
    return sortDir === 'asc'
      ? <ChevronUpIcon className="h-3 w-3 text-blue-600" />
      : <ChevronDownIcon className="h-3 w-3 text-blue-600" />
  }

  const handlePreview = async (file: FileRecord) => {
    if (previewFile?.id === file.id) {
      setPreviewFile(null)
      setPreviewContent('')
      return
    }
    setPreviewFile(file)
    try {
      const c = await apiReadFile(sandboxPath, file.fileName)
      setPreviewContent(c.length > 3000 ? c.substring(0, 3000) + '\n...' : c)
    }
    catch {
      setPreviewContent('读取失败')
    }
  }

  const handleDownload = async (file: FileRecord) => {
    try {
      const c = await apiReadFile(sandboxPath, file.fileName)
      const b = new Blob([c], { type: 'text/markdown;charset=utf-8' })
      const u = URL.createObjectURL(b)
      const a = document.createElement('a')
      a.href = u
      a.download = file.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(u)
    }
    catch {
      alert('下载失败')
    }
  }

  const handleDelete = async (file: FileRecord) => {
    if (!confirm(`确定删除 ${file.fileName}？`)) return
    try {
      await apiDeleteFile(sandboxPath, file.fileName)
      setFiles(p => p.filter(f => f.id !== file.id))
      if (previewFile?.id === file.id) {
        setPreviewFile(null)
        setPreviewContent('')
      }
    }
    catch {
      alert('删除失败')
    }
  }

  const handleSyncToKnowledge = async () => {
    if (!files.length) return
    const name = prompt('知识库名称', '沙箱脱敏知识库')
    if (!name) return
    setIsSyncing(true)
    setSyncMsg('')
    try {
      const data = await post<Record<string, unknown>>('/data-masking/sandbox/sync-to-knowledge', {
        body: { sandbox_path: sandboxPath, dataset_name: name },
      })
      if (data.result === 'success')
        setSyncMsg(`同步成功！已创建知识库「${data.dataset_name}」，共 ${data.file_count} 个文件`)
      else
        setSyncMsg((data.error as string) || '同步失败')
    }
    catch (err: unknown) {
      let msg = '同步失败'
      if (err instanceof Response) {
        try {
          const data = await err.json()
          msg = data.message || data.error || String(err.status)
        }
        catch { msg = String(err.status) }
      }
      else if (err instanceof Error) {
        msg = err.message
      }
      setSyncMsg('同步失败: ' + msg)
    }
    finally { setIsSyncing(false) }
  }

  const fmtDate = (iso: string) => {
    if (!iso) return '-'
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  }

  const fmtSize = (b: number) => {
    if (b < 1024) return `${b} B`
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1048576).toFixed(1)} MB`
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg mb-4">{error}</div>
        <button onClick={loadFiles} className="text-sm text-blue-600 hover:text-blue-800">重试</button>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">暂无脱敏文件</h3>
        <p className="mt-1 text-sm text-gray-500">请先在「文件脱敏」标签页执行脱敏操作</p>
        {sandboxPath && (
          <p className="mt-2 text-xs text-gray-400 flex items-center justify-center gap-1">
            <FolderOpenIcon className="h-3.5 w-3.5" />{sandboxPath}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filtered.length} / {files.length} 个文件</span>
          <span className="text-xs text-green-600 flex items-center gap-1">
            <FolderOpenIcon className="h-3.5 w-3.5" />{sandboxPath}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索文件名..."
              className="pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-52"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >✕</button>
            )}
          </div>
          <button
            onClick={handleSyncToKnowledge}
            disabled={isSyncing || files.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? '同步中...' : '同步到知识库'}
          </button>
          <button onClick={loadFiles} className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1.5">刷新</button>
        </div>
      </div>

      {syncMsg && (
        <div className={`rounded-md px-3 py-2 text-xs ${syncMsg.includes('成功') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {syncMsg}
        </div>
      )}
      {/* Table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleSort('fileName')}>
                <span className="inline-flex items-center gap-1">文件 <SortIcon field="fileName" /></span>
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleSort('size')}>
                <span className="inline-flex items-center gap-1">大小 <SortIcon field="size" /></span>
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleSort('createdAt')}>
                <span className="inline-flex items-center gap-1">创建时间 <SortIcon field="createdAt" /></span>
              </th>
              <th className="relative py-3 pl-3 pr-4 text-right text-sm font-semibold text-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {paginated.map(file => (
              <tr key={file.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm">
                  <div className="flex items-center gap-2">
                    <DocumentIcon className="h-5 w-5 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-900 truncate max-w-[400px]" title={file.fileName}>{file.fileName}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">{fmtSize(file.size)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />{fmtDate(file.createdAt)}
                  </div>
                </td>
                <td className="relative whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => handlePreview(file)} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900">
                      <EyeIcon className="h-4 w-4" />预览
                    </button>
                    <button onClick={() => handleDownload(file)} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900">
                      <ArrowDownTrayIcon className="h-4 w-4" />下载
                    </button>
                    <button onClick={() => handleDelete(file)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-900">
                      <TrashIcon className="h-4 w-4" />删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
                  未找到匹配「{search}」的文件
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>条</span>
            <span className="text-gray-400 ml-2">
              第 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} 条，共 {filtered.length} 条
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={safePage <= 1} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" title="首页">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 text-sm font-medium">{safePage} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={safePage >= totalPages} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" title="末页">»</button>
          </div>
        </div>
      )}

      {/* Preview panel */}
      {previewFile && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">{previewFile.fileName}</span>
            <button onClick={() => { setPreviewFile(null); setPreviewContent('') }} className="text-xs text-gray-500 hover:text-gray-700">关闭</button>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{previewContent}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
