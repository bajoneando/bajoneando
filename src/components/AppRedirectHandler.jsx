import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

export default function AppRedirectHandler() {
  const location = useLocation();
  const [showAppBanner, setShowAppBanner] = useState(false);

  useEffect(() => {
    // Si la app se está ejecutando NATIVAMENTE en la app de iOS/Android, no intervenir
    if (Capacitor.isNativePlatform()) return;

    const userAgent = navigator.userAgent || '';
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

    // Solo procesar si el usuario navegó desde un dispositivo móvil
    if (!isAndroid && !isIOS) return;

    const cleanPath = location.pathname.replace(/^\//, '');
    const hasUTM = location.search.includes('utm_source') || location.search.includes('utm_campaign');
    const isPedir = location.pathname.startsWith('/pedir');

    if (hasUTM || isPedir) {
      setShowAppBanner(true);

      // Auto-intentar redirección nativa si vino por WhatsApp HSM o link de campaña
      const hasTriedOpen = sessionStorage.getItem('wepi_auto_app_redirect_tried');
      if (!hasTriedOpen && hasUTM) {
        sessionStorage.setItem('wepi_auto_app_redirect_tried', 'true');

        if (isAndroid) {
          // Lanzador Intent para Android Chrome/WhatsApp Browser
          const intentUrl = `intent://wepi.com.ar/${cleanPath}${location.search}#Intent;scheme=https;package=com.wepi.app;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end;`;
          window.location.href = intentUrl;
        } else if (isIOS) {
          // Custom Scheme iframe launcher para Apple iOS Safari/WhatsApp
          const iosSchemeUrl = `com.wepi.app://${cleanPath}${location.search}`;
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = iosSchemeUrl;
          document.body.appendChild(iframe);
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }
      }
    }
  }, [location]);

  const handleManualOpenApp = () => {
    const userAgent = navigator.userAgent || '';
    const isAndroid = /Android/i.test(userAgent);
    const cleanPath = location.pathname.replace(/^\//, '');

    if (isAndroid) {
      window.location.href = `intent://wepi.com.ar/${cleanPath}${location.search}#Intent;scheme=https;package=com.wepi.app;end;`;
    } else {
      window.location.href = `com.wepi.app://${cleanPath}${location.search}`;
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
      background: 'linear-gradient(90deg, #1e293b, #0f172a)',
      color: '#fff',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
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
          onClick={handleManualOpenApp}
          style={{
            background: '#e11d48',
            color: '#fff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '0.8rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(225,29,72,0.4)'
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
