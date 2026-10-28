import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Camera, Loader2, LogOut, SlidersHorizontal, UserRound } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { useAction } from '../lib/action'
import { Avatar, useEsc, useToast } from '../ui'

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
  const { busy, run } = useAction()
  useEsc(onClose)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.right')) onClose() }
    setTimeout(() => document.addEventListener('click', h))
    ref.current?.querySelector<HTMLElement>('a, button')?.focus()
    return () => document.removeEventListener('click', h)
  }, [onClose])
  const upload = (f?: File) => f && run(async () => {
    const photo = await resizeImage(f, 320)
    await api('/s/rm', { method: 'PATCH', body: { photo } })
    invalidate('/s/rm')
    toast('Profile photo updated')
  }, 'Couldn’t update your photo')
  return (
    <div className="menu" ref={ref} aria-label="Your profile and settings">
      <div className="menu-head">
        <button onClick={() => file.current?.click()} className="menu-photo" aria-label="Change profile photo" disabled={busy}>
          <Avatar name={rm?.name || ''} photo={rm?.photo} size={44} />
          <span className="menu-photo-badge" aria-hidden>{busy ? <Loader2 size={11} className="spin" /> : <Camera size={11} />}</span>
        </button>
        <div className="grow">
          <div className="strong">{rm?.name}</div>
          <div className="tiny muted">{rm?.title}</div>
          <div className="tiny muted">{rm?.branch}</div>
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <nav>
        <Link to="/me"><UserRound aria-hidden />My profile</Link>
        <Link to="/preferences"><SlidersHorizontal aria-hidden />Preferences</Link>
        <Link to="/handbook"><BookOpen aria-hidden />Handbook</Link>
      </nav>
      <div className="divider" style={{ margin: '4px 0' }} />
      <button className="mi" onClick={onOut}><LogOut aria-hidden />Sign out</button>
    </div>
  )
}
