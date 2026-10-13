import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cormorant-garamond/700.css'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'
import { definirCentroDemo } from './lib/demo.ts'
import { ProvedorSessao } from './lib/sessao.tsx'
import { modoDemo } from './lib/supabase.ts'

// Na demonstração, os pontos de exemplo aparecem perto de onde você está.
if (modoDemo) {
  navigator.geolocation?.getCurrentPosition((pos) => definirCentroDemo(pos.coords.latitude, pos.coords.longitude))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProvedorSessao>
      <App />
    </ProvedorSessao>
  </StrictMode>,
)
