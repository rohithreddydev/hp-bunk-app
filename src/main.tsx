import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[PWA] Service worker registered:', reg.scope);
        // Check for updates every 60s — clear on unload to prevent memory leak
        const swUpdateInterval = setInterval(() => reg.update(), 60_000);
        window.addEventListener('beforeunload', () => clearInterval(swUpdateInterval));
      })
      .catch(err => console.warn('[PWA] SW registration failed:', err));
  });
}
