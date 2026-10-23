import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Camera, LogOut, SlidersHorizontal, UserRound } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { Avatar, useToast } from '../ui'

export async function resizeImage(file: File, max = 320, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
  const s = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return c.toDataURL('image/jpeg', quality)
}

export default function ProfileMenu({ rm, onClose, onOut }: { rm: any; onClose: () => void; onOut: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const toast = useToast()
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.right')) onClose() }
    setTimeout(() => document.addEventListener('click', h))
    return () => document.removeEventListener('click', h)
  }, [onClose])
  const upload = async (f?: File) => {
    if (!f) return
    const photo = await resizeImage(f, 320)
    await api('/s/rm', { method: 'PATCH', body: { photo } })
    invalidate('/s/rm')
    toast('Profile photo updated')
  }
  return (
    <div className="menu" ref={ref} role="menu">
      <div className="menu-head">
        <button onClick={() => file.current?.click()} title="Change photo" style={{ position: 'relative' }}>
          <Avatar name={rm?.name || ''} photo={rm?.photo} size={44} />
          <span style={{ position: 'absolute', right: -2, bottom: -2, background: 'var(--paper)', borderRadius: '50%', padding: 3, border: '1px solid var(--line)', display: 'grid' }}><Camera size={11} /></span>
        </button>
        <div className="grow">
          <div className="strong">{rm?.name}</div>
          <div className="tiny muted">{rm?.title} · {rm?.branch}</div>
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <Link to="/me" role="menuitem"><UserRound />My profile</Link>
      <Link to="/preferences" role="menuitem"><SlidersHorizontal />Preferences</Link>
      <Link to="/handbook" role="menuitem"><BookOpen />Handbook</Link>
      <div className="divider" style={{ margin: '4px 0' }} />
      <button className="mi" onClick={onOut} role="menuitem"><LogOut />Sign out</button>
    </div>
  )
}
