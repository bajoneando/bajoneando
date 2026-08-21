import { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import * as api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [driver, setDriver] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId && userId !== 'undefined') {
      setUser({
        id: userId,
        name: localStorage.getItem('userName') || '',
        email: localStorage.getItem('userEmail') || '',
        address: localStorage.getItem('userAddress') || '',
        telefono: localStorage.getItem('userTelefono') || '',
        emailConfirmado: localStorage.getItem('userEmailConfirmado') === 'true',
        role: localStorage.getItem('userRole') || 'user',
        ya_realizo_pedidos: localStorage.getItem('userYaRealizoPedidos') === 'true',
        ciudad: localStorage.getItem('userCiudad') || 'Santo Tomé',
        onesignal_id: localStorage.getItem('userOnesignalId') || null
      });
    } else if (userId === 'undefined') {
      // Limpiar datos corruptos
      ['userId', 'userName', 'userEmail', 'userAddress', 'userTelefono', 'userEmailConfirmado', 'userRole', 'userYaRealizoPedidos', 'userCiudad', 'userOnesignalId'].forEach(k => localStorage.removeItem(k));
    }
    const localToken = localStorage.getItem('localToken');
    if (localToken) {
      setRestaurant({ 
        id: localToken,
        emailConfirmado: localStorage.getItem('localEmailConfirmado') === 'true',
        role: localStorage.getItem('localRole') || 'Admin'
      });
    }
    const repartidorId = localStorage.getItem('repartidorId');
    if (repartidorId) {
      setDriver({ 
        id: repartidorId,
        emailConfirmado: localStorage.getItem('driverEmailConfirmado') === 'true',
        esPartner: localStorage.getItem('driverEsPartner') === 'true',
        partnerId: localStorage.getItem('driverPartnerId') || null
      });
    }
  }, []);

  const loginAsUser = (data) => {
    const userId = data.userId || data.id;
    localStorage.setItem('userId', userId);
    localStorage.setItem('userName', data.name || data.nombre || '');
    localStorage.setItem('userEmail', data.email || '');
    localStorage.setItem('userAddress', data.address || data.direccion || '');
    localStorage.setItem('userTelefono', data.telefono || '');
    localStorage.setItem('userEmailConfirmado', String(!!(data.emailConfirmado || data.email_confirmado)));
    localStorage.setItem('userRole', data.role || 'user');
    localStorage.setItem('userYaRealizoPedidos', String(!!data.ya_realizo_pedidos));
    localStorage.setItem('userCiudad', data.ciudad || 'Santo Tomé');
    if (data.onesignal_id) {
      localStorage.setItem('userOnesignalId', data.onesignal_id);
    } else {
      localStorage.removeItem('userOnesignalId');
    }
    setUser({ 
      id: data.userId || data.id, 
      name: data.name || data.nombre, 
      email: data.email, 
      address: data.address || data.direccion,
      telefono: data.telefono,
      emailConfirmado: !!(data.emailConfirmado || data.email_confirmado),
      role: data.role || 'user',
      ya_realizo_pedidos: (data.ya_realizo_pedidos === true || data.ya_realizo_pedidos === 'true' || data.ya_realizo_pedidos === 1 || data.ya_realizo_pedidos === '1' || data.ya_realizo_pedidos === 'TRUE'),
      ciudad: data.ciudad || 'Santo Tomé',
      onesignal_id: data.onesignal_id || null
    });
  };

  const logoutUser = async () => {
    // Limpiar estado React e historial local de inmediato
    setUser(null);
    try {
      const keysToRemove = [
        'userId', 'userName', 'userEmail', 'userAddress', 'userTelefono',
        'userEmailConfirmado', 'userRole', 'userYaRealizoPedidos', 'userCiudad',
        'pendingOrderData', 'pendingOrderDataPruebas', 'wepi_checkout_in_progress'
      ];
      keysToRemove.forEach(k => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    } catch (e) {
      console.error("Error al limpiar storage:", e);
    }

    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase logout error:", e);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      // Sincronizar con Supabase
      const dbUser = await api.syncFirebaseUser(firebaseUser);
      
      if (dbUser.success) {
        loginAsUser({
          userId: dbUser.userId,
          name: dbUser.nombre,
          email: dbUser.email,
          address: dbUser.direccion,
          telefono: dbUser.telefono,
          emailConfirmado: dbUser.emailConfirmado,
          role: dbUser.role,
          ya_realizo_pedidos: dbUser.ya_realizo_pedidos,
          ciudad: dbUser.ciudad || 'Santo Tomé'
        });
        return { success: true, isNew: dbUser.isNew };
      }
      return { success: false, error: 'Error al sincronizar con la base de datos' };
    } catch (error) {
      console.error("Error en login con Google:", error);
      let errMsg = error.message;
      if (error.code === 'auth/unauthorized-domain') {
        errMsg = `Dominio no autorizado en Firebase. Debes registrar el dominio actual ('${window.location.hostname}') en tu consola de Firebase -> Authentication -> Settings (Configuración) -> Authorized Domains (Dominios Autorizados).`;
      }
      return { success: false, error: errMsg };
    }
  };

  const loginAsRestaurant = (data) => {
    const localId = typeof data === 'string' ? data : data.localId;
    const confirmed = typeof data === 'object' ? !!data.emailConfirmado : (localStorage.getItem('localEmailConfirmado') === 'true');
    const role = typeof data === 'object' ? (data.role || 'Admin') : (localStorage.getItem('localRole') || 'Admin');
    
    localStorage.setItem('localToken', localId);
    localStorage.setItem('localEmailConfirmado', String(confirmed));
    localStorage.setItem('localRole', role);
    setRestaurant({ id: localId, emailConfirmado: confirmed, role: role });
  };

  const logoutRestaurant = () => {
    ['localToken', 'localEmailConfirmado', 'localRole'].forEach(k => localStorage.removeItem(k));
    setRestaurant(null);
  };

  const loginAsDriver = (data) => {
    const id = typeof data === 'string' ? data : (data.ID || data.id);
    const confirmed = typeof data === 'object' ? !!(data.EmailConfirmado || data.emailConfirmado) : (localStorage.getItem('driverEmailConfirmado') === 'true');
    const esPartner = typeof data === 'object' ? !!(data.es_partner || data.esPartner) : (localStorage.getItem('driverEsPartner') === 'true');
    const partnerId = typeof data === 'object' ? (data.partner_id || data.partnerId || null) : localStorage.getItem('driverPartnerId');

    localStorage.setItem('repartidorId', id);
    localStorage.setItem('driverEmailConfirmado', String(confirmed));
    localStorage.setItem('driverEsPartner', String(esPartner));
    if (partnerId) {
      localStorage.setItem('driverPartnerId', partnerId);
    } else {
      localStorage.removeItem('driverPartnerId');
    }
    setDriver({ id, emailConfirmado: confirmed, esPartner, partnerId });
  };

  const logoutDriver = () => {
    ['repartidorId', 'driverEmailConfirmado', 'driverEsPartner', 'driverPartnerId'].forEach(k => localStorage.removeItem(k));
    setDriver(null);
  };

  const updateUserAddress = (address) => {
    localStorage.setItem('userAddress', address);
    setUser(prev => prev ? { ...prev, address } : null);
  };

  return (
    <AuthContext.Provider value={{
      user, restaurant, driver,
      loginAsUser, logoutUser, loginWithGoogle,
      loginAsRestaurant, logoutRestaurant,
      loginAsDriver, logoutDriver,
      updateUserAddress,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
