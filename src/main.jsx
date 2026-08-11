// Weep v1.0.2 - Build: 2026-04-11 15:35
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        pauseOnHover={false}
        containerStyle={{
          zIndex: 200000,
        }}
        toastOptions={{
          duration: 2000,
          style: {
            background: '#1a1a2e',
            color: '#fff',
            borderRadius: '12px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.95rem',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          },
          success: { iconTheme: { primary: '#00c853', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ff5252', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
