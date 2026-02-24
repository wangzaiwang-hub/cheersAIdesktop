import * as React from 'react'
import Main from '@/app/components/explore/installed-app'

export const dynamicParams = false

export async function generateStaticParams() {
  return []
}

export type IInstalledAppProps = {
  params?: Promise<{
    appId: string
  }>
}

async function InstalledApp({ params }: IInstalledAppProps) {
  const { appId } = await (params ?? Promise.reject(new Error('Missing params')))
  return (
    <Main id={appId} />
  )
}

export default InstalledApp
