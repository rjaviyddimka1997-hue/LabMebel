import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { readUrlState } from './domain/share'
import './styles.css'

const state = await readUrlState()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialProject={state.project} initialClientMode={state.clientMode} />
  </StrictMode>,
)
