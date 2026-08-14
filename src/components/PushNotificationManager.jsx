import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

export default function PushNotificationManager() {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState(null);

  // Efecto 1: Registrar el dispositivo una sola vez al abrir la app
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Limpiar listeners viejos para evitar duplicados en re-renders
    PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', (token) => {
      console.log('Token de notificaciones registrado:', token.value);
      setPushToken(token.value);
      // Guardar también en localStorage por si acaso
      localStorage.setItem('push_token_temporal', token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error al registrar notificaciones:', JSON.stringify(error));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Notificación recibida en primer plano:', JSON.stringify(notification));
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Usuario tocó la notificación:', JSON.stringify(notification));
    });

    const registerPush = async () => {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('El usuario denegó los permisos de notificaciones push');
        return;
      }

      await PushNotifications.register();
    };

    registerPush();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []); // Se ejecuta solo al montar el componente

  // Efecto 2: Guardar en base de datos cuando tengamos AMBOS (usuario y token)
  useEffect(() => {
    const token = pushToken || localStorage.getItem('push_token_temporal');
    
    if (user?.id && token) {
      console.log('Guardando token en la base de datos para el usuario:', user.id);
      api.usuarioUpdateOneSignalId(user.id, token).catch(err => {
        console.error("Error guardando token push:", err);
      });
    }
  }, [user, pushToken]);

  return null;
}
