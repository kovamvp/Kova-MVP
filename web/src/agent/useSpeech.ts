import { useCallback, useEffect, useRef, useState } from 'react'
import { pref } from '../lib/session'

/* Hybrid speech-to-text.
   1. The browser's speech recognition shows words live while the RM speaks (Chrome/Edge).
   2. In parallel we record the audio; on stop it goes to Whisper (Groq), whose more accurate
      transcript quietly replaces the live text. If either fails, the other still gives a result. */

type State = 'idle' | 'listening' | 'refining'
const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null

export function useSpeech(onFinal: (text: string, meta: { live: string; whisper: string | null; source: string }) => void) {
  const [state, setState] = useState<State>('idle')
  const [live, setLive] = useState('')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<any>(null)
  const media = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const finalText = useRef('')
  const on = useRef(false)
  const raf = useRef(0)
  const started = useRef(0)

  const cleanup = () => {
    cancelAnimationFrame(raf.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setLevel(0)
  }
  useEffect(() => () => { on.current = false; try { rec.current?.abort() } catch {} ; cleanup() }, [])

  const start = useCallback(async () => {
    setError(null)
    finalText.current = ''
    setLive('')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      setError('Microphone access was blocked. Allow it in the browser’s address bar and try again.')
      return
    }
    on.current = true
    started.current = Date.now()
    setState('listening')
    // level meter for the waveform
    try {
      const ctx = new AudioContext()
      const an = ctx.createAnalyser()
      an.fftSize = 256
      ctx.createMediaStreamSource(stream.current).connect(an)
      const buf = new Uint8Array(an.frequencyBinCount)
      const tick = () => {
        an.getByteTimeDomainData(buf)
        let m = 0
        for (const v of buf) m = Math.max(m, Math.abs(v - 128))
        setLevel(Math.min(1, m / 60))
        if (on.current) raf.current = requestAnimationFrame(tick)
        else ctx.close()
      }
      tick()
    } catch {}
    // recorder for Whisper
    chunks.current = []
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || ''
    try {
      media.current = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined)
      media.current.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      media.current.start(1000)
    } catch { media.current = null }
    // live recognition
    if (SR && pref('prefs', { agentVoice: true }).agentVoice !== false) {
      const r = new SR()
      r.lang = 'en-IN'
      r.continuous = true
      r.interimResults = true
      r.onresult = (e: any) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript
          if (e.results[i].isFinal) finalText.current += (finalText.current ? ' ' : '') + t.trim()
          else interim += t
        }
        setLive((finalText.current + ' ' + interim).trim())
      }
      r.onerror = (e: any) => { if (e.error === 'not-allowed') setError('Speech recognition was blocked by the browser.') }
      r.onend = () => { if (on.current) { try { r.start() } catch {} } } // Chrome stops after pauses: restart silently
      try { r.start() } catch {}
      rec.current = r
    }
  }, [])

  const stop = useCallback(async () => {
    if (!on.current) return
    on.current = false
    try { rec.current?.stop() } catch {}
    const liveText = finalText.current || live
    setState('refining')
    const blob: Blob | null = await new Promise((res) => {
      const m = media.current
      if (!m || m.state === 'inactive') return res(null)
      m.onstop = () => res(new Blob(chunks.current, { type: m.mimeType || 'audio/webm' }))
      m.stop()
    })
    cleanup()
    let whisper: string | null = null
    if (blob && blob.size > 2000 && Date.now() - started.current > 700) {
      try {
        const fd = new FormData()
        fd.append('audio', blob, blob.type.includes('mp4') ? 'speech.mp4' : 'speech.webm')
        const r = await fetch('/api/agent/transcribe', { method: 'POST', body: fd })
        if (r.ok) { const t = ((await r.json()).text || '').trim(); whisper = /[a-z0-9]/i.test(t) ? t : null }
      } catch {}
    }
    const text = (whisper || liveText || '').trim()
    setState('idle')
    setLive('')
    if (!text) setError('I didn’t catch anything. Try again a little closer to the mic.')
    else onFinal(text, { live: liveText, whisper, source: whisper ? 'whisper' : 'browser' })
  }, [live, onFinal])

  return { state, live, level, error, start, stop, liveSupported: !!SR && pref('prefs', { agentVoice: true }).agentVoice !== false, clearError: () => setError(null) }
}
