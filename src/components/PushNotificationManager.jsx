import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

export default function PushNotificationManager() {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', (token) => {
      console.log('Token registrado:', token.value);
      setPushToken(token.value);
      localStorage.setItem('push_token_temporal', token.value);
      // ALERTA TEMPORAL PARA DEPUREAR EN IOS
      window.alert("¡Exito! iOS nos dio un Token de Notificaciones: " + token.value.substring(0, 10) + "...");
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error al registrar:', JSON.stringify(error));
      window.alert("Error registrando notificaciones en iOS: " + JSON.stringify(error));
    });

    const registerPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          window.alert("Permiso denegado por el usuario de iOS.");
          return;
        }
        await PushNotifications.register();
      } catch (err) {
        window.alert("Crash al pedir permisos: " + err.message);
      }
    };

    registerPush();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    const token = pushToken || localStorage.getItem('push_token_temporal');
    
    if (user?.id && token) {
      api.usuarioUpdateOneSignalId(user.id, token).then(() => {
        // window.alert("Token guardado en base de datos correctamente para el usuario.");
      }).catch(err => {
        window.alert("Error guardando en Supabase: " + err.message);
      });
    }
  }, [user, pushToken]);

  return null;
}
