import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const statusElement = document.getElementById('boot-status');
    if (statusElement) statusElement.innerText = 'MOUNTING...';
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    // Status update removed to clear UI
  }
} catch (e) {
  console.error('REACT RENDER CRASH:', e);
  const statusElement = document.getElementById('boot-status');
  if (statusElement) statusElement.innerText = 'CRASHED: ' + e.message;
}

