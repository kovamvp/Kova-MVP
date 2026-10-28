import { useCallback, useRef, useState } from 'react'
import { useToast } from '../ui'

/* One way to run a write: the button is busy while it runs (no double submits),
   and a failure says what didn't happen and what to do instead of failing silently. */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const run = useCallback(async <T,>(fn: () => Promise<T>, failed = 'That didn’t go through'): Promise<T | undefined> => {
    if (lock.current) return undefined
    lock.current = true
    setBusy(true)
    try {
      return await fn()
    } catch (e: any) {
      toast(`${failed}. ${e?.message ? `${e.message}. ` : ''}Try again.`)
      return undefined
    } finally {
      lock.current = false
      setBusy(false)
    }
  }, [toast])
  return { busy, run }
}

/* A write that waits a few seconds so the toast's Undo can cancel it.
   Pending writes still go out if the RM leaves the page. */
const pending = new Map<number, () => void>()
let seq = 0
export const UNDO_MS = 5000
export function deferred(commit: () => void, ms = UNDO_MS) {
  const id = ++seq
  const fire = () => { if (pending.delete(id)) commit() }
  pending.set(id, fire)
  window.setTimeout(fire, ms)
  return () => { pending.delete(id) }
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => [...pending.values()].forEach((f) => f()))
