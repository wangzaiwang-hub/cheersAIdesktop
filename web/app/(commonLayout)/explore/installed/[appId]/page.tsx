import InstalledAppClient from './_client-page'

export const dynamicParams = false

export async function generateStaticParams() {
  return []
}

export default function Page() {
  return <InstalledAppClient />
}
