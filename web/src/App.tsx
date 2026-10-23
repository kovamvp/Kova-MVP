import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { signedIn } from './lib/session'
import { ToastHost } from './ui'
import Shell from './shell/Shell'
import Login from './shell/Login'
import Home from './pages/Home'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Prospects from './pages/Prospects'
import ProspectDetail from './pages/ProspectDetail'
import Meetings from './pages/Meetings'
import Studio from './pages/Studio'
import StudioCanvas from './pages/StudioCanvas'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Growth from './pages/Growth'
import Requests from './pages/Requests'
import { Handbook, Preferences, Profile } from './pages/Me'

export default function App() {
  const [authed, setAuthed] = useState(signedIn())
  if (!authed) return <ToastHost><Login onIn={() => setAuthed(true)} /></ToastHost>
  return (
    <ToastHost>
      <Routes>
        <Route element={<Shell onOut={() => setAuthed(false)} />}>
          <Route index element={<Home />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="prospects" element={<Prospects />} />
          <Route path="prospects/:id" element={<ProspectDetail />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="studio" element={<Studio />} />
          <Route path="studio/:id" element={<StudioCanvas />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="growth" element={<Growth />} />
          <Route path="requests" element={<Requests />} />
          <Route path="me" element={<Profile />} />
          <Route path="preferences" element={<Preferences />} />
          <Route path="handbook" element={<Handbook />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastHost>
  )
}
