const fs = require('fs');
let code = fs.readFileSync('src/pages/DriverDashboard.jsx', 'utf8');

// Remove the instruction banner entirely
code = code.replace(/\{isIOS && !isStandalone \? \([\s\S]*?\}\)/g, '');

// The above regex might leave broken JSX inside the `<span className="banner-text">` block
// Let's do a more precise replacement for the notification banner logic.
const bannerTarget = `            <span className="banner-text">
              {notificationStatus === 'denied' ? (
                <>🚫 <strong>Bloqueadas:</strong> No recibirás alertas de pedidos. Revisa los permisos.</>
              ) : (
                <>
                  {isIOS && !isStandalone ? (
                    <>📱 <strong>Activa la App:</strong> Añade Wepi al inicio para habilitar el GPS.</>
                  ) : (
                    <>🔔 <strong>Activa alertas:</strong> Presiona el botón para recibir pedidos al instante.</>
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
                <>🔔 <strong>Activa alertas:</strong> Presiona el botón para recibir pedidos al instante.</>
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

// Also remove the modal
code = code.replace(/\{showPWAInstructions && \([\s\S]*?\}\);?\s*\}/g, '');

fs.writeFileSync('src/pages/DriverDashboard.jsx', code);
console.log("Cleaned PWA banners from DriverDashboard");
