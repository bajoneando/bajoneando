import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import admin from "npm:firebase-admin@12.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Inicializar Firebase Admin (se hará dentro de la request para asegurar acceso a Deno.env)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📥 Payload Firebase recibido:", JSON.stringify(body, null, 2));

    const { tokens, title, message, data, url } = body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      throw new Error("Missing required parameters: tokens (Array)");
    }

    // Inicializar Firebase Admin si no lo está
    if (!admin.apps.length) {
      const serviceAccountKey = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
      if (!serviceAccountKey) {
        throw new Error("Missing FIREBASE_SERVICE_ACCOUNT secret.");
      }
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin inicializado correctamente dentro de la request.");
      } catch (err) {
        throw new Error("Failed to parse FIREBASE_SERVICE_ACCOUNT or initialize Admin: " + err.message);
      }
    }

    // Preparar el payload de FCM
    // Nota: todos los valores dentro de 'data' deben ser strings.
    const normalizedData = {};
    if (data) {
      for (const key in data) {
        normalizedData[key] = String(data[key]);
      }
    }
    normalizedData['url'] = url || "https://wepi.com.ar/pedir";

    const payload = {
      notification: {
        title: title || "Wepi",
        body: message || "Tienes una nueva actualización",
      },
      data: normalizedData,
    };

    console.log("🚀 Enviando a Firebase FCM:", JSON.stringify(payload, null, 2));

    // Enviar mensaje a múltiples tokens de a uno para evitar el error 404 de la API /batch deprecada
    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens,
      notification: payload.notification,
      data: payload.data,
      // Opciones para Android (reemplazo automático de notificaciones amontonadas)
      android: {
        priority: 'high',
        collapseKey: 'wepi_push_general',
        notification: {
          sound: 'default',
          tag: 'wepi_notification',
          sticky: false,
          defaultSound: true,
          notificationCount: 1
        }
      },
      // Opciones para iOS (Apple APNs)
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      },
      // Opciones para Web Push
      webpush: {
        headers: {
          Urgency: 'high',
          Topic: 'wepi_notification'
        },
        notification: {
          tag: 'wepi_notification',
          renotify: true
        }
      }
    });

    console.log(`✅ Push Firebase exitoso. Éxitos: ${response.successCount}, Fallos: ${response.failureCount}`);
    if (response.failureCount > 0) {
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          console.error(`Fallo para el token ${tokens[idx]}:`, res.error);
        }
      });
    }

    return new Response(JSON.stringify({ success: true, data: response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("❌ Error enviando Firebase push:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
