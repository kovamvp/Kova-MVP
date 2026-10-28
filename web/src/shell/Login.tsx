import { FormEvent, useState } from 'react'
import { signIn } from '../lib/session'

export default function Login({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('priya.sharma@kova.in')
  const [pw, setPw] = useState('demo-access')
  const [busy, setBusy] = useState(false)
  /* busy while signing in, so a second press does nothing (single sign-on will make this a real wait) */
  const submit = (e: FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); signIn(); onIn() }
  return (
    <div className="login">
      <div className="login-art">
        <div className="login-lockup">
          <img src="/mark-light.svg" alt="" className="login-mark" width={300} height={300} />
          <img src="/wordmark-light.svg" alt="KOVA" height={30} style={{ height: 30, width: 'auto', display: 'block' }} />
          <p className="login-story">Two hands, one foundation. Everything a client has built, held in one place, by people who know them.</p>
        </div>
      </div>
      <form className="login-form" onSubmit={submit}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <h1>Kova Work</h1>
          <p className="muted" style={{ marginTop: 6, marginBottom: 28 }}>Sign in to your workspace.</p>
          <div className="col" style={{ gap: 14 }}>
            <label className="field"><span>Work email</span><input className="input" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" spellCheck={false} /></label>
            <label className="field"><span>Password</span><input className="input" type="password" name="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
            <button className="btn btn-primary" style={{ height: 42, marginTop: 6 }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
          <p className="tiny faint" style={{ marginTop: 28 }}>Demo workspace with sample data only. Single sign-on with your Kova account arrives in the full release.</p>
        </div>
      </form>
    </div>
  )
}
