'use client'
import type { FC } from 'react'
import { useState } from 'react'
import { useTranslation } from '#i18n'
import { PlusIcon } from '@heroicons/react/24/outline'
import Button from '@/app/components/base/button'
import type { MaskingRule } from '@/service/data-masking'

const DataMaskingList: FC = () => {
  const { t } = useTranslation('dataMasking')
  const [rules] = useState<MaskingRule[]>([])
  const isLoading = false

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-12 pt-8 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {t('dataMasking.title', { ns: 'common' })}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('dataMasking.description', { ns: 'common' })}
          </p>
        </div>
        <Button
          type="primary"
          className="flex items-center gap-2"
          onClick={() => console.log('Create new masking rule')}
        >
          <PlusIcon className="w-4 h-4" />
          {t('dataMasking.createRule', { ns: 'common' })}
        </Button>
      </div>

      <div className="flex-1 px-12 pb-8 overflow-y-auto">
        {isLoading
          ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">
                {t('loading', { ns: 'common' })}
              </div>
            </div>
            )
          : rules.length === 0
            ? (
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-gray-900">
                    {t('dataMasking.noRules', { ns: 'common' })}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('dataMasking.noRulesDescription', { ns: 'common' })}
                  </p>
                  <div className="mt-6">
                    <Button
                      type="primary"
                      className="flex items-center gap-2"
                      onClick={() => console.log('Create first masking rule')}
                    >
                      <PlusIcon className="w-4 h-4" />
                      {t('dataMasking.createFirstRule', { ns: 'common' })}
                    </Button>
                  </div>
                </div>
              </div>
              )
            : (
              <div className="space-y-4">
                {rules.map(rule => (
                  <div
                    key={rule.id}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">
                          {rule.name}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {rule.type} • {rule.pattern}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded ${rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {rule.enabled ? t('dataMasking.enabled', { ns: 'common' }) : t('dataMasking.disabled', { ns: 'common' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
      </div>
    </div>
  )
}

export default DataMaskingList
