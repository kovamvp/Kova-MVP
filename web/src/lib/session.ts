const KEY = 'kova.session'
export function signedIn() { try { return localStorage.getItem(KEY) === '1' } catch { return memory } }
let memory = false
export function signIn() { memory = true; try { localStorage.setItem(KEY, '1') } catch {} }
export function signOut() { memory = false; try { localStorage.removeItem(KEY) } catch {} }
export function pref<T>(k: string, fallback: T): T { try { const v = localStorage.getItem('kova.' + k); return v ? JSON.parse(v) : fallback } catch { return fallback } }
export function setPref(k: string, v: unknown) { try { localStorage.setItem('kova.' + k, JSON.stringify(v)) } catch {} }

/* recently opened clients, prospects and products: a per-device convenience for the search palette */
export type Recent = { kind: string; id: string; title: string; sub: string }
export function recent(): Recent[] { return pref<Recent[]>('recent', []) }
export function pushRecent(r: Recent) { setPref('recent', [r, ...recent().filter((x) => !(x.kind === r.kind && x.id === r.id))].slice(0, 5)) }
