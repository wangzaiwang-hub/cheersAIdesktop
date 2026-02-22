const API_BASE = '/console/api/data-masking/sandbox/files'

function apiUrl(path: string): string {
  // Backend runs on port 5001
  return `http://localhost:5001${path}`
}

export interface SandboxFileInfo {
  name: string
  size: number
  created_at: string
}

export async function saveSandboxFile(
  sandboxPath: string,
  fileName: string,
  content: string,
): Promise<{ result: string; file_path: string; file_name: string; size: number }> {
  const res = await fetch(apiUrl(API_BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sandbox_path: sandboxPath, file_name: fileName, content }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Save failed: ${res.status}`)
  }
  return res.json()
}

export async function listSandboxFiles(sandboxPath: string): Promise<SandboxFileInfo[]> {
  const url = `${apiUrl(`${API_BASE}/list`)}?sandbox_path=${encodeURIComponent(sandboxPath)}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `List failed: ${res.status}`)
  }
  const data = await res.json()
  return data.files || []
}

export async function readSandboxFile(
  sandboxPath: string,
  fileName: string,
): Promise<string> {
  const params = new URLSearchParams({ sandbox_path: sandboxPath, file_name: fileName })
  const res = await fetch(`${apiUrl(`${API_BASE}/read`)}?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Read failed: ${res.status}`)
  }
  const data = await res.json()
  return data.content
}

export async function deleteSandboxFile(
  sandboxPath: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(apiUrl(`${API_BASE}/delete`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sandbox_path: sandboxPath, file_name: fileName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Delete failed: ${res.status}`)
  }
}
