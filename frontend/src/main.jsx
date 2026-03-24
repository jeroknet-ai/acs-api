import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

const rootElement = document.getElementById('root');
if (rootElement) {
  const statusElement = document.getElementById('boot-status');
  if (statusElement) statusElement.innerText = 'MOUNTED';
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
