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

    PushNotifications.addListener('registration', async (token) => {
      console.log('Token APNs o Android registrado:', token.value);
      try {
        const { FCM } = await import('@capacitor-community/fcm');
        const fcmTokenResponse = await FCM.getToken();
        const finalToken = fcmTokenResponse.token || token.value;
        console.log('FCM Token obtenido:', finalToken);
        setPushToken(finalToken);
        localStorage.setItem('push_token_temporal', finalToken);
      } catch (err) {
        console.error("Error obteniendo FCM Token (usando fallback):", err);
        setPushToken(token.value);
        localStorage.setItem('push_token_temporal', token.value);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error al registrar:', JSON.stringify(error));
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
