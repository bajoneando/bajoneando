import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

export default function PushNotificationManager() {
  const { user, driver, localUser } = useAuth();
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

    // Limpiar notificaciones de la bandeja al hacer clic o abrir la app
    PushNotifications.addListener('pushNotificationActionPerformed', async (notification) => {
      console.log('Notificación tocada/abierta:', notification);
      try {
        await PushNotifications.removeAllDeliveredNotifications();
      } catch (e) {
        console.warn("Error limpiando notificaciones entregadas:", e);
      }
    });

    const registerPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          return;
        }
        await PushNotifications.register();
        // Limpiar bandeja de notificaciones acumuladas al iniciar
        await PushNotifications.removeAllDeliveredNotifications().catch(() => {});
      } catch (err) {
        console.warn("Error registrando notificaciones push:", err.message);
      }
    };

    registerPush();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    const token = pushToken || localStorage.getItem('push_token_temporal');
    
    if (token) {
      if (user?.id) {
        api.usuarioUpdateOneSignalId(user.id, token).catch(err => console.error("Error guardando en usuarios:", err));
      }
      if (driver?.id) {
        api.repartidorUpdateOneSignalId(driver.id, token).catch(err => console.error("Error guardando en repartidores:", err));
        api.repartidorUpdateFcmToken(driver.id, token).catch(err => console.error("Error guardando FCM en repartidores:", err));
      }
      if (localUser?.id) {
        api.localUpdateOneSignalId(localUser.id, token).catch(err => console.error("Error guardando en locales:", err));
      }
    }
  }, [user, driver, localUser, pushToken]);

  return null;
}
