import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { EntryRouter } from './EntryRouter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EntryRouter />
  </StrictMode>,
)
