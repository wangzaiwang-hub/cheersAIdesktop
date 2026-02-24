'use client'
import * as React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RiShieldCheckLine,
  RiSettings4Line,
  RiFileShield2Line,
  RiFolderShield2Line,
  RiAddLine,
  RiDeleteBinLine,
  RiToggleLine,
  RiToggleFill,
  RiEditLine,
  RiRefreshLine,
} from '@remixicon/react'
import useDocumentTitle from '@/hooks/use-document-title'
import { RulesManager } from '@/lib/data-masking/rules-manager'
import type { MaskingRule } from '@/lib/data-masking/types'
import { SandboxConfig } from '@/app/components/data-masking/sandbox-config'
import { FileMasking } from '@/app/components/data-masking/file-masking'
import { FileList } from '@/app/components/data-masking/file-list'
import { RuleForm } from '@/app/components/data-masking/rule-form'

type TabType = 'mask' | 'rules' | 'files' | 'sandbox'

const TABS: { id: TabType; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'mask', name: '文件脱敏', icon: RiFileShield2Line },
  { id: 'rules', name: '脱敏规则', icon: RiShieldCheckLine },
  { id: 'files', name: '文件管理', icon: RiFolderShield2Line },
  { id: 'sandbox', name: '沙箱配置', icon: RiSettings4Line },
]

function NeedSandbox({ onGoConfig }: { onGoConfig: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <RiSettings4Line className="w-12 h-12 text-gray-300 mb-4" />
      <h3 className="text-sm font-medium text-gray-900 mb-1">请先配置沙箱路径</h3>
      <p className="text-xs text-gray-500 mb-4">脱敏文件将保存到沙箱目录</p>
      <button
        onClick={onGoConfig}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        前往配置
      </button>
    </div>
  )
}

function RulesPanel({
  rules,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  onRefresh,
}: {
  rules: MaskingRule[]
  isLoading: boolean
  onAdd: () => void
  onEdit: (rule: MaskingRule) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onRefresh: () => void
}) {
  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-sm text-gray-500">加载中...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{rules.length} 条规则</span>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="p-1.5 rounded hover:bg-gray-100" title="刷新">
            <RiRefreshLine className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <RiAddLine className="w-4 h-4" />新建规则
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12">
          <RiShieldCheckLine className="mx-auto w-12 h-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">暂无脱敏规则</p>
          <p className="text-xs text-gray-400 mt-1">点击「新建规则」或使用预设模板快速创建</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`border rounded-lg p-3 transition-colors ${rule.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{rule.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      {rule.strategy.type}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{rule.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                    {typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.source}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <button onClick={() => onToggle(rule.id)} className="p-1 rounded hover:bg-gray-100" title={rule.enabled ? '禁用' : '启用'}>
                    {rule.enabled
                      ? <RiToggleFill className="w-5 h-5 text-blue-600" />
                      : <RiToggleLine className="w-5 h-5 text-gray-400" />}
                  </button>
                  <button onClick={() => onEdit(rule)} className="p-1 rounded hover:bg-gray-100" title="编辑">
                    <RiEditLine className="w-4 h-4 text-gray-500" />
                  </button>
                  <button onClick={() => onDelete(rule.id)} className="p-1 rounded hover:bg-gray-100" title="删除">
                    <RiDeleteBinLine className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DataMaskingPage() {
  useDocumentTitle('数据脱敏')

  const [activeTab, setActiveTab] = useState<TabType>('mask')
  const [sandboxPath, setSandboxPath] = useState('')
  const [rules, setRules] = useState<MaskingRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<MaskingRule | undefined>()
  const rulesManagerRef = useRef<RulesManager | null>(null)

  // Initialize sandbox path from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sandbox_path')
    if (saved && !saved.startsWith('[')) {
      setSandboxPath(saved)
    }
  }, [])

  // Initialize rules manager
  useEffect(() => {
    const mgr = new RulesManager()
    rulesManagerRef.current = mgr
    mgr.initialize().then(() => loadRules(mgr)).catch(console.error)
    return () => mgr.close()
  }, [])

  const loadRules = useCallback(async (mgr?: RulesManager) => {
    const manager = mgr || rulesManagerRef.current
    if (!manager) return
    setIsLoading(true)
    try {
      const all = await manager.getAllRules()
      setRules(all.sort((a, b) => a.priority - b.priority))
    }
    catch (err) {
      console.error('Failed to load rules:', err)
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  const handleSandboxConfigured = useCallback((path: string) => {
    setSandboxPath(path)
  }, [])

  const handleCreateRule = useCallback(async (data: Omit<MaskingRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const mgr = rulesManagerRef.current
    if (!mgr) return
    try {
      await mgr.createRule(data)
      await loadRules(mgr)
      setShowForm(false)
      setEditingRule(undefined)
    }
    catch (err) {
      console.error('Failed to create rule:', err)
    }
  }, [loadRules])

  const handleUpdateRule = useCallback(async (data: Omit<MaskingRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const mgr = rulesManagerRef.current
    if (!mgr || !editingRule) return
    try {
      await mgr.updateRule(editingRule.id, data)
      await loadRules(mgr)
      setShowForm(false)
      setEditingRule(undefined)
    }
    catch (err) {
      console.error('Failed to update rule:', err)
    }
  }, [editingRule, loadRules])

  const handleDeleteRule = useCallback(async (id: string) => {
    const mgr = rulesManagerRef.current
    if (!mgr) return
    if (!confirm('确定删除该规则？')) return
    try {
      await mgr.deleteRule(id)
      await loadRules(mgr)
    }
    catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }, [loadRules])

  const handleToggleRule = useCallback(async (id: string) => {
    const mgr = rulesManagerRef.current
    if (!mgr) return
    const rule = rules.find(r => r.id === id)
    if (!rule) return
    try {
      await mgr.updateRule(id, { enabled: !rule.enabled })
      await loadRules(mgr)
    }
    catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }, [rules, loadRules])

  const needsSandbox = !sandboxPath && (activeTab === 'mask' || activeTab === 'files')

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Horizontal tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {tab.name}
              </button>
            )
          })}
          {sandboxPath && (
            <span className="ml-auto text-xs text-gray-400 truncate max-w-[200px]" title={sandboxPath}>
              📁 {sandboxPath}
            </span>
          )}
        </div>

        {/* Content */}
        {activeTab === 'mask' && (
          needsSandbox
            ? <NeedSandbox onGoConfig={() => setActiveTab('sandbox')} />
            : <FileMasking sandboxPath={sandboxPath} />
        )}

        {activeTab === 'rules' && (
          <RulesPanel
            rules={rules}
            isLoading={isLoading}
            onAdd={() => { setEditingRule(undefined); setShowForm(true) }}
            onEdit={(rule) => { setEditingRule(rule); setShowForm(true) }}
            onDelete={handleDeleteRule}
            onToggle={handleToggleRule}
            onRefresh={() => loadRules()}
          />
        )}

        {activeTab === 'files' && (
          needsSandbox
            ? <NeedSandbox onGoConfig={() => setActiveTab('sandbox')} />
            : <FileList sandboxPath={sandboxPath} />
        )}

        {activeTab === 'sandbox' && (
          <SandboxConfig onConfigured={handleSandboxConfigured} />
        )}
      </div>

      {/* Rule form modal */}
      {showForm && (
        <RuleForm
          rule={editingRule}
          onSave={editingRule ? handleUpdateRule : handleCreateRule}
          onCancel={() => { setShowForm(false); setEditingRule(undefined) }}
        />
      )}
    </div>
  )
}

export default React.memo(DataMaskingPage)
