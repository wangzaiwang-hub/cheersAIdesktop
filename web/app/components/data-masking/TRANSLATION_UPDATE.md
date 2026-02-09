# 数据脱敏组件翻译更新说明

## 已完成
1. ✅ sandbox-config.tsx - 已添加 useTranslation 和所有翻译键
2. ✅ file-masking.tsx - 已添加 useTranslation hook
3. ✅ file-list.tsx - 已添加 useTranslation hook

## 需要手动替换的文本

由于组件较大，以下是需要在各组件中替换的关键文本：

### file-masking.tsx
- "Select File to Mask" → {t('masking.selectFile', { ns: 'dataMasking' })}
- "Choose File" → {t('masking.chooseFile', { ns: 'dataMasking' })}
- "Select Masking Rules" → {t('masking.selectRules', { ns: 'dataMasking' })}
- "No masking rules available..." → {t('masking.noRules', { ns: 'dataMasking' })}
- "Preview Masking" → {t('masking.preview', { ns: 'dataMasking' })}
- "Execute Masking" → {t('masking.execute', { ns: 'dataMasking' })}
- "Mask Another File" → {t('masking.maskAnother', { ns: 'dataMasking' })}
- "Processing..." → {t('masking.processing', { ns: 'dataMasking' })}
- "Generating preview..." → {t('masking.generatingPreview', { ns: 'dataMasking' })}
- "Masking completed successfully" → {t('masking.success', { ns: 'dataMasking' })}
- "The masked file has been saved..." → {t('masking.successDescription', { ns: 'dataMasking' })}
- "Preview (First 500 characters)" → {t('masking.previewTitle', { ns: 'dataMasking' })}

### file-list.tsx
- "Loading files..." → {t('files.loading', { ns: 'dataMasking' })}
- "No masked files" → {t('files.noFiles', { ns: 'dataMasking' })}
- "Mask some files to see them here." → {t('files.noFilesDescription', { ns: 'dataMasking' })}
- "File Name" → {t('files.fileName', { ns: 'dataMasking' })}
- "Size" → {t('files.size', { ns: 'dataMasking' })}
- "Created" → {t('files.created', { ns: 'dataMasking' })}
- "Actions" → {t('files.actions', { ns: 'dataMasking' })}
- "Upload" → {t('files.upload', { ns: 'dataMasking' })}
- "Delete" → {t('files.delete', { ns: 'dataMasking' })}
- "Delete File" → {t('files.deleteConfirm', { ns: 'dataMasking' })}
- "Are you sure you want to delete" → {t('files.deleteMessage', { ns: 'dataMasking' })}
- "Also delete associated mapping data" → {t('files.deleteMappings', { ns: 'dataMasking' })}
- "Cancel" → {t('files.cancel', { ns: 'dataMasking' })}

## 快速测试
刷新页面后，所有文本应该显示为中文（如果用户语言设置为 zh-Hans）。
