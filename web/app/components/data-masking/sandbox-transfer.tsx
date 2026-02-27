'use client'

import { useEffect, useState } from 'react'
import {
  RiDownloadLine,
  RiUploadLine,
  RiLockLine,
  RiCheckLine,
  RiLock2Line,
  RiDeleteBinLine,
} from '@remixicon/react'

interface SandboxTransferProps {
  sandboxPath: string
}

const PIN_STORAGE_KEY = 'sandbox_export_pin'

export function SandboxTransfer({ sandboxPath }: SandboxTransferProps) {
  const [hasPinSet, setHasPinSet] = useState(false)
  const [setupPin, setSetupPin] = useState('')
  const [setupPinConfirm, setSetupPinConfirm] = useState('')
  const [setupMsg, setSetupMsg] = useState('')

  const [verifyPin, setVerifyPin] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  const [importPin, setImportPin] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importResult, setImportResult] = useState<string[]>([])

  useEffect(() => {
    if (localStorage.getItem(PIN_STORAGE_KEY))
      setHasPinSet(true)
  }, [])

  const handleSetPin = () => {
    if (!setupPin || setupPin.length < 4) { setSetupMsg('PIN 至少 4 位'); return }
    if (setupPin !== setupPinConfirm) { setSetupMsg('两次输入的 PIN 不一致'); return }
    localStorage.setItem(PIN_STORAGE_KEY, setupPin)
    setHasPinSet(true)
    setSetupPin('')
    setSetupPinConfirm('')
    setSetupMsg('')
  }

  const handleClearPin = () => {
    localStorage.removeItem(PIN_STORAGE_KEY)
    setHasPinSet(false)
    setVerifyPin('')
    setExportMsg('')
  }

  const handleExport = async () => {
    const savedPin = localStorage.getItem(PIN_STORAGE_KEY) || ''
    if (!verifyPin) { setExportMsg('请输入 PIN 密码'); return }
    if (verifyPin !== savedPin) { setExportMsg('PIN 密码错误'); return }
    setIsExporting(true)
    setExportMsg('')
    try {
      const res = await fetch('http://localhost:5001/console/api/data-masking/sandbox/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandbox_path: sandboxPath, pin: verifyPin }),
      })
      const text = await res.text()
      let data: Record<string, unknown>
      try { data = JSON.parse(text) }
      catch { setExportMsg(`后端返回异常: ${text.slice(0, 200)}`); return }
      if (!res.ok || data.result !== 'success') { setExportMsg((data.error as string) || '导出失败'); return }
      setExportMsg(`导出成功，${data.file_count} 个文件已打包到沙箱目录`)
      setVerifyPin('')
    }
    catch { setExportMsg('导出失败，请确认后端已启动') }
    finally { setIsExporting(false) }
  }

  const handleImport = async () => {
    if (!importFile) { setImportMsg('请选择 ZIP 文件'); return }
    if (!importPin) { setImportMsg('请输入 PIN'); return }
    setIsImporting(true)
    setImportMsg('')
    setImportResult([])
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('pin', importPin)
      formData.append('sandbox_path', sandboxPath)
      const res = await fetch('http://localhost:5001/console/api/data-masking/sandbox/import', {
        method: 'POST',
        body: formData,
      })
      const text = await res.text()
      let data: Record<string, unknown>
      try { data = JSON.parse(text) }
      catch { setImportMsg(`后端返回异常: ${text.slice(0, 200)}`); return }
      if (data.result === 'success') {
        setImportMsg(`导入成功，共 ${data.count} 个文件`)
        setImportResult((data.imported_files as string[]) || [])
        setImportPin('')
        setImportFile(null)
      }
      else { setImportMsg((data.error as string) || '导入失败') }
    }
    catch { setImportMsg('导入失败，请确认后端已启动') }
    finally { setIsImporting(false) }
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Export (left) + Import (right) */}
      <div className="grid grid-cols-2 gap-6">
        {/* Export */}
        <div className={`rounded-lg border border-gray-200 bg-white p-5 ${!hasPinSet ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <RiDownloadLine className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">导出沙箱</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            输入密码验证后，将沙箱目录中的所有文件打包为 ZIP 压缩包保存到沙箱目录。
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">验证 PIN 密码</label>
              <div className="relative">
                <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={verifyPin}
                  onChange={e => setVerifyPin(e.target.value)}
                  placeholder="输入导出密码"
                  onKeyDown={e => e.key === 'Enter' && handleExport()}
                  className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {exportMsg && (
              <p className={`text-xs ${exportMsg.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
                {exportMsg}
              </p>
            )}
            <button
              onClick={handleExport}
              disabled={isExporting || !verifyPin}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RiDownloadLine className="w-4 h-4" />
              {isExporting ? '导出中...' : '验证并导出'}
            </button>
          </div>
        </div>

        {/* Import */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <RiUploadLine className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">导入沙箱</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            上传 ZIP 压缩包，输入导出时设置的 PIN 密码校验后导入。
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">选择 ZIP 文件</label>
              <input
                type="file"
                accept=".zip"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">输入 PIN 密码</label>
              <div className="relative">
                <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={importPin}
                  onChange={e => setImportPin(e.target.value)}
                  placeholder="输入导出时设置的 PIN"
                  onKeyDown={e => e.key === 'Enter' && handleImport()}
                  className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {importMsg && (
              <p className={`text-xs ${importMsg.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
                {importMsg}
              </p>
            )}
            {importResult.length > 0 && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3">
                <p className="text-xs font-medium text-green-800 mb-1">已导入文件：</p>
                <ul className="space-y-0.5">
                  {importResult.map(f => (
                    <li key={f} className="flex items-center gap-1 text-xs text-green-700">
                      <RiCheckLine className="w-3 h-3" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={isImporting || !importFile || !importPin}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RiUploadLine className="w-4 h-4" />
              {isImporting ? '导入中...' : '校验并导入'}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: PIN setup — full width */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <RiLock2Line className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">沙箱密码设置</h3>
          {hasPinSet && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <RiCheckLine className="w-3 h-3" />已设置
            </span>
          )}
        </div>

        {!hasPinSet ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">设置导出密码后，每次导出都需要验证密码。导入时也需要输入相同的密码。</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">设置 PIN 密码（至少 4 位）</label>
                <div className="relative">
                  <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={setupPin}
                    onChange={e => setSetupPin(e.target.value)}
                    placeholder="输入 PIN"
                    className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">确认 PIN 密码</label>
                <div className="relative">
                  <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={setupPinConfirm}
                    onChange={e => setSetupPinConfirm(e.target.value)}
                    placeholder="再次输入 PIN"
                    onKeyDown={e => e.key === 'Enter' && handleSetPin()}
                    className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            {setupMsg && <p className="text-xs text-red-600">{setupMsg}</p>}
            <button
              onClick={handleSetPin}
              disabled={!setupPin}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RiLockLine className="w-4 h-4" />保存密码
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500 flex-1">导出密码已设置，导出时需要验证。</p>
            <button
              onClick={handleClearPin}
              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
            >
              <RiDeleteBinLine className="w-3.5 h-3.5" />重置密码
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">使用说明</h4>
        <ul className="space-y-1 text-xs text-blue-800">
          <li>• 首先在下方设置导出密码，设置后每次导出都需要验证</li>
          <li>• 导出的 ZIP 文件保存在沙箱目录下</li>
          <li>• 导入时需要输入导出时设置的 PIN，校验通过后文件解压到当前沙箱目录</li>
          <li>• 可用于跨设备、跨平台迁移脱敏文件</li>
        </ul>
      </div>
    </div>
  )
}
