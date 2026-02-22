'use client'
import type { FC } from 'react'
import { useState } from 'react'
import { RiCloseLine } from '@remixicon/react'
import type { MaskingRule, MaskingStrategy } from '@/lib/data-masking/types'
import { RULE_TEMPLATES } from '@/lib/data-masking/rules-manager'

interface RuleFormProps {
  rule?: MaskingRule
  onSave: (data: Omit<MaskingRule, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

const STRATEGY_OPTIONS = [
  { value: 'replacement', label: '替换' },
  { value: 'tokenization', label: '令牌化' },
  { value: 'format-preserving', label: '格式保留' },
]

const TEMPLATE_LIST = Object.entries(RULE_TEMPLATES).map(([key, tpl]) => ({
  key,
  name: tpl.name,
  description: tpl.description,
}))

export const RuleForm: FC<RuleFormProps> = ({ rule, onSave, onCancel }) => {
  const [name, setName] = useState(rule?.name ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [pattern, setPattern] = useState(
    rule?.pattern ? (typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.source) : '',
  )
  const [strategyType, setStrategyType] = useState<string>(rule?.strategy?.type ?? 'replacement')
  const [strategyValue, setStrategyValue] = useState(() => {
    if (!rule?.strategy) return '***'
    const s = rule.strategy as Record<string, string>
    return s.value ?? s.prefix ?? s.format ?? '***'
  })
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)
  const [priority, setPriority] = useState(rule?.priority ?? 1)
  const [error, setError] = useState('')

  const applyTemplate = (key: string) => {
    const tpl = RULE_TEMPLATES[key as keyof typeof RULE_TEMPLATES]
    if (!tpl) return
    setName(tpl.name)
    setDescription(tpl.description)
    setPattern(typeof tpl.pattern === 'string' ? tpl.pattern : tpl.pattern.source)
    setStrategyType(tpl.strategy.type)
    setStrategyValue((tpl.strategy as Record<string, string>).value ?? '***')
    setPriority(tpl.priority)
    setEnabled(tpl.enabled)
  }

  const buildStrategy = (): MaskingStrategy => {
    switch (strategyType) {
      case 'tokenization':
        return { type: 'tokenization', prefix: strategyValue }
      case 'format-preserving':
        return { type: 'format-preserving', format: strategyValue }
      default:
        return { type: 'replacement', value: strategyValue }
    }
  }

  const handleSubmit = () => {
    setError('')
    if (!name.trim()) { setError('请输入规则名称'); return }
    if (!pattern.trim()) { setError('请输入匹配模式'); return }
    try { new RegExp(pattern) } catch { setError('正则表达式无效'); return }

    onSave({
      name: name.trim(),
      description: description.trim(),
      pattern,
      strategy: buildStrategy(),
      enabled,
      priority,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {rule ? '编辑规则' : '创建脱敏规则'}
          </h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-gray-100">
            <RiCloseLine className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Templates */}
          {!rule && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">快速选择模板</label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_LIST.map(tpl => (
                  <button
                    key={tpl.key}
                    onClick={() => applyTemplate(tpl.key)}
                    className="px-3 py-1.5 text-xs rounded-full border border-gray-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：手机号脱敏"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="规则用途说明"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">匹配模式（正则表达式）</label>
            <input
              type="text"
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              placeholder="例如：1[3-9]\d{9}"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Strategy */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">脱敏策略</label>
              <select
                value={strategyType}
                onChange={e => setStrategyType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {STRATEGY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">替换值</label>
              <input
                type="text"
                value={strategyValue}
                onChange={e => setStrategyValue(e.target.value)}
                placeholder="***"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Priority & Enabled */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
              <input
                type="number"
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">启用规则</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            {rule ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
