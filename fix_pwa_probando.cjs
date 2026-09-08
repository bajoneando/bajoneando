const fs = require('fs');
let code = fs.readFileSync('src/pages/DriverProbando.jsx', 'utf8');

const bannerTarget = `            <span className="banner-text">
              {notificationStatus === 'denied' ? (
                <>🚫 <strong>Bloqueadas:</strong> No recibirás alertas de pedidos. Revisa los permisos.</>
              ) : (
                <>
                  {isIOS && !isStandalone ? (
                    <>📱 <strong>Activa la App:</strong> Añade Wepi al inicio para habilitar el GPS.</>
                  ) : (
                    <>🔔 <strong>Activa alertas:</strong> Recibe notificaciones al instante.</>
                  )}
                </>
              )}
            </span>
            <div className="banner-actions">
              {(isIOS || isAndroid) && !isStandalone ? (
                <button 
                  className="btn btn-outline btn-sm" 
                  onClick={() => setShowPWAInstructions(true)}
                >
                  {isIOS ? '🍎 Instrucciones' : (deferredPrompt ? '⬇️ Descargar' : 'ℹ️ Info')}
                </button>
              ) : null}
              {notificationStatus !== 'denied' && (!isIOS || isStandalone) && (
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => {
                    if (window.OneSignal) {
                      window.OneSignal.Notifications.requestPermission();
                    }
                  }}
                >
                  Activar 🔔
                </button>
              )}
            </div>`;

const bannerReplacement = `            <span className="banner-text">
              {notificationStatus === 'denied' ? (
                <>🚫 <strong>Bloqueadas:</strong> No recibirás alertas de pedidos. Revisa los permisos.</>
              ) : (
                <>🔔 <strong>Activa alertas:</strong> Recibe notificaciones al instante.</>
              )}
            </span>
            <div className="banner-actions">
              {notificationStatus !== 'denied' && (
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => {
                    if (window.OneSignal) {
                      window.OneSignal.Notifications.requestPermission();
                    }
                  }}
                >
                  Activar 🔔
                </button>
              )}
            </div>`;

code = code.replace(bannerTarget, bannerReplacement);
code = code.replace(/\{showPWAInstructions && \([\s\S]*?\}\);?\s*\}/g, '');

fs.writeFileSync('src/pages/DriverProbando.jsx', code);
console.log("Cleaned PWA banners from DriverProbando");
