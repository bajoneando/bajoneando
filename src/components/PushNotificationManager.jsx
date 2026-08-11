import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

export default function PushNotificationManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

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

    PushNotifications.addListener('registration',
      (token) => {
        console.log('Token de notificaciones registrado:', token.value);
        // TODO: Aquí en el futuro puedes guardar el token.value en Supabase asociado al user.id
        // para enviarle notificaciones personalizadas.
        if (user?.id) {
           console.log('Guardar token para el usuario:', user.id);
           api.usuarioUpdateOneSignalId(user.id, token.value).catch(err => console.error("Error guardando token push:", err));
        }
      }
    );

    PushNotifications.addListener('registrationError',
      (error) => {
        console.error('Error al registrar notificaciones:', JSON.stringify(error));
      }
    );

    PushNotifications.addListener('pushNotificationReceived',
      (notification) => {
        console.log('Notificación recibida en primer plano:', JSON.stringify(notification));
      }
    );

    PushNotifications.addListener('pushNotificationActionPerformed',
      (notification) => {
        console.log('Usuario tocó la notificación:', JSON.stringify(notification));
      }
    );

    registerPush();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user]);

  return null;
}
