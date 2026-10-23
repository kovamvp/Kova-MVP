import { useCallback, useEffect, useRef, useState } from 'react'

export class ApiError extends Error {}

export async function api<T = any>(path: string, opts: { method?: string; body?: any; form?: FormData } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method || (opts.body || opts.form ? 'POST' : 'GET') }
  if (opts.form) init.body = opts.form
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body)
    init.headers = { 'content-type': 'application/json' }
  }
  const r = await fetch(`/api${path}`, init)
  const text = await r.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = { error: text } }
  if (!r.ok) throw new ApiError(data?.detail || data?.error || `Request failed (${r.status})`)
  return data as T
}

// tiny cache + pub/sub so pages refresh after an action anywhere in the app
const cache = new Map<string, any>()
const subs = new Map<string, Set<() => void>>()
export function invalidate(prefix = '') {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k)
  for (const [k, set] of subs) if (k.startsWith(prefix)) set.forEach((fn) => fn())
}

export function useApi<T = any>(path: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | undefined>(path ? cache.get(path) : undefined)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!path && !cache.has(path))
  const alive = useRef(true)
  const load = useCallback(async () => {
    if (!path) return
    try {
      const d = await api<T>(path)
      cache.set(path, d)
      if (alive.current) { setData(d); setError(null) }
    } catch (e: any) {
      if (alive.current) setError(e.message)
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [path])
  useEffect(() => {
    alive.current = true
    if (!path) return
    setData(cache.get(path))
    setLoading(!cache.has(path))
    load()
    let set = subs.get(path)
    if (!set) subs.set(path, (set = new Set()))
    set.add(load)
    const t = opts.poll ? window.setInterval(load, opts.poll) : 0
    return () => { alive.current = false; set!.delete(load); if (t) clearInterval(t) }
  }, [path, load, opts.poll])
  return { data, error, loading, reload: load, setData }
}
