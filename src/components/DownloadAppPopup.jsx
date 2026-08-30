import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import './DownloadAppPopup.css';

export default function DownloadAppPopup() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    
    const dismissed = sessionStorage.getItem('download_app_popup_dismissed');
    if (dismissed) return;

    if (!user) {
      const timer = setTimeout(() => {
        setShow(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // Fallback check in case local storage is stale
      if (user.onesignal_id) return;
      import('../services/api').then(api => {
        api.getUsuarioByEmail(user.email).then(dbUser => {
          if (!dbUser || !dbUser.onesignal_id) {
            setShow(true);
          }
        }).catch(() => setShow(true));
      });
    }
  }, [user]);

  if (!show) return null;

  return (
    <div className="download-app-overlay">
      <div className="download-app-modal">
        <h2>Ahora tenés Wepi más cerca que nunca.</h2>
        <div className="download-app-links">
          <a href="https://apps.apple.com/ar/app/wepi-app/id6801576564" target="_blank" rel="noopener noreferrer">
            <img src="https://i.postimg.cc/3xLdFwyB/disponible-app-store-rtt.png" alt="Descargar en App Store" />
          </a>
          <a href="https://api.whatsapp.com/send/?phone=3756543610&text=Quiero+la+App+de+Wepi+para+Android" target="_blank" rel="noopener noreferrer">
            <img src="https://i.postimg.cc/TYddN6vJ/disponible-en-google-play-badge-1.png" alt="Disponible en Google Play" />
          </a>
        </div>
        <button 
          className="download-app-close" 
          onClick={() => {
            setShow(false);
            sessionStorage.setItem('download_app_popup_dismissed', 'true');
          }}
        >
          Omitir
        </button>
      </div>
    </div>
  );
}
