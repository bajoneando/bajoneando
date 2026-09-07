import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

export default function AppRedirectHandler() {
  const location = useLocation();
  const [showAppBanner, setShowAppBanner] = useState(false);

  useEffect(() => {
    // Si la app se está ejecutando NATIVAMENTE dentro de iOS o Android, no hacer nada
    if (Capacitor.isNativePlatform()) return;

    const userAgent = navigator.userAgent || '';
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

    if (!isAndroid && !isIOS) return;

    const hasUTM = location.search.includes('utm_source') || location.search.includes('utm_campaign');
    const isPedir = location.pathname.startsWith('/pedir');

    if (hasUTM || isPedir) {
      setShowAppBanner(true);

      // En Android Chrome podemos intentar abrir la app mediante Intent
      const hasTriedOpen = sessionStorage.getItem('wepi_auto_app_redirect_tried');
      if (!hasTriedOpen && isAndroid) {
        sessionStorage.setItem('wepi_auto_app_redirect_tried', 'true');
        const cleanPath = location.pathname.replace(/^\//, '');
        const intentUrl = `intent://wepi.com.ar/${cleanPath}${location.search}#Intent;scheme=https;package=com.wepi.app;S.browser_fallback_url=${encodeURIComponent(window.location.href + '?tried=1')};end;`;
        window.location.href = intentUrl;
      }
    }
  }, [location]);

  const handleOpenApp = () => {
    const userAgent = navigator.userAgent || '';
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const cleanPath = location.pathname.replace(/^\//, '');

    if (isAndroid) {
      window.location.href = `intent://wepi.com.ar/${cleanPath}${location.search}#Intent;scheme=https;package=com.wepi.app;end;`;
    } else if (isIOS) {
      // Usar esquema limpio wepi:// para iOS evitando bloqueos y errores de dirección no válida
      const appUrl = `wepi://${cleanPath}${location.search}`;
      const start = Date.now();
      window.location.href = appUrl;

      // Fallback seguro: si no tiene la App instalada, derivar a la tienda tras 1.5s
      setTimeout(() => {
        if (Date.now() - start < 2000) {
          // Redirigir a App Store de Wepi
          window.location.href = `https://apps.apple.com/app/wepi/id6742398436`;
        }
      }, 1500);
    }
  };

  if (!showAppBanner || Capacitor.isNativePlatform()) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 99999,
      background: 'linear-gradient(90deg, #0f172a, #1e293b)',
      color: '#fff',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
      borderBottom: '2px solid #e11d48'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.4rem' }}>📱</span>
        <div>
          <strong style={{ fontSize: '0.88rem', display: 'block' }}>¿Tenés la App de Wepi?</strong>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Abrí tu pedido directamente en la app nativa</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handleOpenApp}
          style={{
            background: '#e11d48',
            color: '#fff',
            border: 'none',
            padding: '7px 14px',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '0.8rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(225,29,72,0.4)'
          }}
        >
          Abrir App
        </button>
        <button
          onClick={() => setShowAppBanner(false)}
          style={{
            background: 'transparent',
            color: '#94a3b8',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
