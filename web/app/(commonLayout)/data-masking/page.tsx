'use client'
import type { FC } from 'react'
import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  RiShieldCheckLine,
  RiSettings4Line,
  RiFileShield2Line,
  RiFolderShield2Line,
} from '@remixicon/react'
import useDocumentTitle from '@/hooks/use-document-title'
import { RulesManager } from '@/lib/data-masking/rules-manager'
import type { MaskingRule } from '@/lib/data-masking/types'
import { SandboxConfig } from '@/app/components/data-masking/sandbox-config'
import { FileMasking } from '@/app/components/data-masking/file-masking'
import { FileList } from '@/app/components/data-masking/file-list'
import { RuleForm } from '@/app/components/data-masking/rule-form'

type TabType = 'rules' | 'sandbox' | 'mask' | 'files'

const DataMaskingPage: FC = () => {
  useDocumentTitle('数据脱敏')
  
  const [activeTab, setActiveTab] = useState<TabType>('rules')
  const [rules, setRules] = useState<MaskingRule[]>([])
  const [sandboxPath, setSandboxPath] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [rulesManager] = useState(() => new RulesManager())
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<MaskingRule | undefined>()

  // Load rules and sandbox path on mount
  useEffect(() => {
    loadRules()
    loadSandboxPath()
  }, [])

  const loadRules = async () => {
    setIsLoading(true)
    try {
      await rulesManager.initialize()
      const loadedRules = await rulesManager.getAllRules()
      setRules(loadedRules)
    }
    catch (err) {
      console.error('Failed to load rules:', err)
    }
    finally {
      setIsLoading(false)
    }
  }

  const loadSandboxPath = () => {
    const saved = localStorage.getItem('sandbox_path')
    if (saved && !saved.startsWith('['))
      setSandboxPath(saved)
  }

  const handleSandboxConfigured = (path: string) => {
    setSandboxPath(path)
    localStorage.setItem('sandbox_path', path)
  }

  const handleCreateRule = async (data: Omit<MaskingRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await rulesManager.createRule(data)
      await loadRules()
      setShowForm(false)
    }
    catch (err) {
      console.error('Failed to create rule:', err)
    }
  }

  const handleUpdateRule = async (data: Omit<MaskingRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingRule) return
    try {
      await rulesManager.updateRule(editingRule.id, data)
      await loadRules()
      setShowForm(false)
      setEditingRule(undefined)
    }
    catch (err) {
      console.error('Failed to update rule:', err)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('确定要删除这条规则吗？')) return
    try {
      await rulesManager.deleteRule(ruleId)
      await loadRules()
    }
    catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await rulesManager.updateRule(ruleId, { enabled })
      await loadRules()
    }
    catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }

  const tabs = [
    {
      id: 'rules' as TabType,
      name: '脱敏规则',
      icon: RiShieldCheckLine,
    },
    {
      id: 'sandbox' as TabType,
      name: '沙箱配置',
      icon: RiSettings4Line,
    },
    {
      id: 'mask' as TabType,
      name: '文件脱敏',
      icon: RiFileShield2Line,
    },
    {
      id: 'files' as TabType,
      name: '文件管理',
      icon: RiFolderShield2Line,
    },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-12 pt-8 pb-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            数据脱敏
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            使用可配置的脱敏规则保护敏感数据
          </p>
        </div>

        {/* Tabs */}
        <div className="px-12">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                    ${isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-12 py-8">
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    脱敏规则
                  </h2>
                  <button
                    onClick={() => { setEditingRule(undefined); setShowForm(true) }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <RiShieldCheckLine className="w-4 h-4" />
                    添加规则
                  </button>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-sm text-gray-500">加载中...</div>
                  </div>
                ) : rules.length === 0 ? (
                  <div className="text-center py-12">
                    <RiShieldCheckLine className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">暂无脱敏规则</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      创建您的第一条脱敏规则开始使用
                    </p>
                    <button
                      onClick={() => { setEditingRule(undefined); setShowForm(true) }}
                      className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      创建规则
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map(rule => (
                      <div
                        key={rule.id}
                        className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="text-sm font-medium text-gray-900">
                                {rule.name}
                              </h3>
                              <span className={`px-2 py-0.5 text-xs rounded ${rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {rule.enabled ? '已启用' : '已禁用'}
                              </span>
                              <span className="text-xs text-gray-400">
                                优先级: {rule.priority}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {rule.description}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400 font-mono">
                              {typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.source}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                              className={`px-2.5 py-1 text-xs rounded ${rule.enabled ? 'text-orange-700 bg-orange-50 hover:bg-orange-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}
                            >
                              {rule.enabled ? '禁用' : '启用'}
                            </button>
                            <button
                              onClick={() => { setEditingRule(rule); setShowForm(true) }}
                              className="px-2.5 py-1 text-xs text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="px-2.5 py-1 text-xs text-red-700 bg-red-50 rounded hover:bg-red-100"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                沙箱配置
              </h2>
              <SandboxConfig onConfigured={handleSandboxConfigured} />
            </div>
          )}

          {activeTab === 'mask' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                文件脱敏
              </h2>
              {!sandboxPath ? (
                <div className="text-center py-12">
                  <RiSettings4Line className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    沙箱未配置
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    请先配置沙箱目录
                  </p>
                  <button
                    onClick={() => setActiveTab('sandbox')}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    配置沙箱
                  </button>
                </div>
              ) : (
                <FileMasking rules={rules} sandboxPath={sandboxPath} />
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                脱敏文件
              </h2>
              {!sandboxPath ? (
                <div className="text-center py-12">
                  <RiSettings4Line className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    沙箱未配置
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    请先配置沙箱目录
                  </p>
                  <button
                    onClick={() => setActiveTab('sandbox')}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    配置沙箱
                  </button>
                </div>
              ) : (
                <FileList sandboxPath={sandboxPath} onRefresh={loadRules} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rule Form Modal */}
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
