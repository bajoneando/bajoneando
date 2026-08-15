import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    console.log("📥 Payload recibido:", JSON.stringify(body, null, 2));

    const { subscriptionIds, title, message, data, url, broadcastOrderId, localId, precioEnvio } = body;
    const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const onesignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!onesignalAppId || !onesignalApiKey) {
      console.error("❌ Error: ONESIGNAL_APP_ID o ONESIGNAL_REST_API_KEY no están configurados.");
      throw new Error("ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY is not configured in Supabase Edge Functions");
    }

    if (broadcastOrderId) {
      console.log(`⚡ Procesando broadcast en tiempo real para pedido: ${broadcastOrderId}`);
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!supabaseUrl || !supabaseServiceRole) {
        throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured");
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceRole);

      // 1. Verificar si el pedido sigue disponible (repartidor_id es NULL)
      const { data: order, error: orderErr } = await supabase
        .from('pedidos_general')
        .select('repartidor_id, estado, local_id, precio_envio')
        .eq('id', broadcastOrderId)
        .single();

      if (orderErr || !order) {
        console.error(`❌ [Broadcast] Error al buscar pedido ${broadcastOrderId}:`, orderErr);
        return new Response(JSON.stringify({ success: false, error: 'Order not found or error fetching' }), {
          headers: corsHeaders,
          status: 200 // Consistent with Wepi error wrapper response pattern
        });
      }

      if (order.repartidor_id) {
        console.log(`⚠️ [Broadcast] El pedido ${broadcastOrderId} ya tiene repartidor asignado: ${order.repartidor_id}. Abortando push.`);
        return new Response(JSON.stringify({ success: true, message: 'Already assigned' }), {
          headers: corsHeaders
        });
      }

      // CRÍTICO: El pedido debe estar en un estado activo de búsqueda de repartidor ('Buscando Repartidor' o 'Pendiente')
      if (order.estado !== 'Buscando Repartidor' && order.estado !== 'Pendiente') {
        console.log(`⚠️ [Broadcast] El pedido ${broadcastOrderId} no está en estado activo de búsqueda (Estado: ${order.estado}). Abortando push.`);
        return new Response(JSON.stringify({ success: true, message: `Order not in active search state: ${order.estado}` }), {
          headers: corsHeaders
        });
      }

      const finalLocalId = localId || order.local_id;
      const finalPrecioEnvio = precioEnvio || order.precio_envio || 0;

      // Obtener datos del local de forma explícita y robusta
      let nombreLocal = "";
      let ciudadLocal = "";
      if (finalLocalId) {
        const { data: localData } = await supabase
          .from('locales')
          .select('nombre, ciudad')
          .eq('id', finalLocalId)
          .single();
        if (localData) {
          nombreLocal = localData.nombre || "";
          ciudadLocal = localData.ciudad || "";
        }
      }

      // 2. Obtener repartidores aceptados con su partner_id
      const { data: drivers, error: driversErr } = await supabase
        .from('repartidores')
        .select('onesignal_id, fcm_token, locales_prioridad, ciudad, partner_id')
        .eq('admin_status', 'Aceptado');

      if (driversErr || !drivers || drivers.length === 0) {
        console.log("⚠️ [Broadcast] No hay repartidores en la base de datos.");
        return new Response(JSON.stringify({ success: true, message: 'No drivers to notify' }), {
          headers: corsHeaders
        });
      }

      // 3. Consultar configuración de la ciudad para ver tipo de logística
      let configCiudad = null;
      if (ciudadLocal) {
        try {
          const { data: config } = await supabase
            .from('ciudades_config')
            .select('tipo_logistica, partner_oficial_id')
            .eq('ciudad', ciudadLocal)
            .maybeSingle();
          configCiudad = config;
        } catch (err) {
          console.error("Error al obtener ciudades_config en send-push:", err);
        }
      }

      // 4. Filtrar repartidores:
      // Si la ciudad es de tipo partner, enviamos solo a los vinculados a dicho partner
      // Si es local, enviamos solo a los independientes (sin partner_id)
      let targetDrivers = drivers;
      if (ciudadLocal) {
        if (configCiudad?.tipo_logistica === 'partner') {
          const partnerId = configCiudad.partner_oficial_id;
          targetDrivers = drivers.filter(d => d.ciudad === ciudadLocal && d.partner_id === partnerId);
          console.log(`📌 [Broadcast] Ciudad Partner detectada (${ciudadLocal}). Notificando solo a repartidores vinculados al partner ${partnerId}. Total: ${targetDrivers.length}`);
        } else {
          targetDrivers = drivers.filter(d => d.ciudad === ciudadLocal && !d.partner_id);
          console.log(`📌 [Broadcast] Ciudad Local detectada (${ciudadLocal}). Notificando solo a repartidores independientes. Total: ${targetDrivers.length}`);
        }
      }

      const titleStr = '¡Nuevo Pedido Disponible! 🛵';
      const messageStr = nombreLocal
        ? `¡Nuevo pedido en ${nombreLocal}! Generá $${Number(finalPrecioEnvio).toLocaleString('es-AR')}`
        : `¡Nuevo pedido! Generá $${Number(finalPrecioEnvio).toLocaleString('es-AR')}`;

      // Separar prioritarios y comunes
      const priorityDrivers = finalLocalId ? targetDrivers.filter(d => d.locales_prioridad?.includes(finalLocalId)) : [];
      const otherDrivers = targetDrivers.filter(d => !priorityDrivers.includes(d));

      const sendToHybrid = async (targetDriversList: any[]) => {
        const osIds = targetDriversList.map(d => d.onesignal_id).filter(Boolean);
        const fcmTokens = targetDriversList.map(d => d.fcm_token).filter(Boolean);
        
        if (osIds.length === 0 && fcmTokens.length === 0) return;

        // Enviar por OneSignal
        if (osIds.length > 0) {
          const payloadOS = {
            app_id: onesignalAppId,
            include_subscription_ids: osIds,
            headings: { "es": titleStr, "en": titleStr },
            contents: { "es": messageStr, "en": messageStr },
            url: "https://wepi.com.ar/repartidores",
            data: { pedidoId: broadcastOrderId, type: 'new_order_broadcast' }
          };

          fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Authorization": `Basic ${onesignalApiKey}`,
            },
            body: JSON.stringify(payloadOS),
          }).then(res => res.json()).then(res => console.log(`📡 [Broadcast OS] Enviado a ${osIds.length}.`, JSON.stringify(res))).catch(console.error);
        }

        // Enviar por Firebase FCM (llamando a la otra Edge Function para reusar SDK Admin)
        if (fcmTokens.length > 0) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
          const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          
          fetch(`${supabaseUrl}/functions/v1/send-firebase-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceRole}`
            },
            body: JSON.stringify({
              tokens: fcmTokens,
              title: titleStr,
              message: messageStr,
              data: { pedidoId: broadcastOrderId, type: 'new_order_broadcast' },
              url: "https://wepi.com.ar/repartidores"
            })
          }).then(res => res.json()).then(res => console.log(`🔥 [Broadcast FCM] Enviado a ${fcmTokens.length}.`, JSON.stringify(res))).catch(console.error);
        }
      };

      // Si hay repartidores con prioridad, enviamos inmediato a ellos, y programamos con waitUntil el resto
      if (priorityDrivers.length > 0) {
        console.log(`🔔 [Broadcast] Enviando notificación inmediata a ${priorityDrivers.length} repartidores prioritarios.`);
        await sendToHybrid(priorityDrivers);

        if (otherDrivers.length > 0) {
          const delayedTask = async () => {
            try {
              console.log(`⏳ [Broadcast-Delayed] Esperando 10 segundos antes de enviar al resto (${otherDrivers.length})...`);
              await new Promise(resolve => setTimeout(resolve, 10000));

              // Volver a consultar estado del pedido y repartidor_id antes de mandar al resto
              const { data: freshOrder, error: freshErr } = await supabase
                .from('pedidos_general')
                .select('repartidor_id, estado')
                .eq('id', broadcastOrderId)
                .single();

              if (freshErr || !freshOrder) {
                console.log(`[Broadcast-Delayed] No se pudo re-verificar el pedido ${broadcastOrderId}. Abortando resto.`);
                return;
              }

              if (freshOrder.repartidor_id) {
                console.log(`[Broadcast-Delayed] El pedido fue tomado durante la espera por ${freshOrder.repartidor_id}. Cancelando envío secundario.`);
                return;
              }

              // CRÍTICO: Verificar si el pedido sigue activo en búsqueda de repartidor
              if (freshOrder.estado !== 'Buscando Repartidor' && freshOrder.estado !== 'Pendiente') {
                console.log(`[Broadcast-Delayed] El pedido cambió a estado no activo de búsqueda (${freshOrder.estado}) durante la espera. Cancelando envío secundario.`);
                return;
              }

              console.log(`[Broadcast-Delayed] El pedido sigue libre. Enviando al resto de los ${otherDrivers.length} repartidores.`);
              await sendToHybrid(otherDrivers);
            } catch (err) {
              console.error("[Broadcast-Delayed] Error en tarea diferida:", err);
            }
          };

          // Registrar en el runtime de Deno para mantener la ejecución viva
          // @ts-ignore global EdgeRuntime
          if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
            // @ts-ignore
            EdgeRuntime.waitUntil(delayedTask());
          } else {
            // Fallback para entornos locales de prueba
            delayedTask().catch(console.error);
          }
        }
      } else {
        console.log(`🔔 [Broadcast] No hay prioritarios. Enviando notificación inmediata a todos los ${targetDrivers.length} repartidores.`);
        await sendToHybrid(targetDrivers);
      }

      return new Response(JSON.stringify({ success: true, message: 'Broadcast initiated successfully' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- FALLBACK ORIGINAL ---
    if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      console.error("❌ Error: subscriptionIds no es un array válido o está vacío.");
      throw new Error("Missing required parameters: subscriptionIds (Array)");
    }

    const payload = {
      app_id: onesignalAppId,
      include_subscription_ids: subscriptionIds,
      headings: { 
        "es": title || "Wepi",
        "en": title || "Wepi" 
      },
      contents: { 
        "es": message || "Tienes una nueva actualización",
        "en": message || "You have a new update"
      },
      url: url || "https://wepi.com.ar/repartidores",
      data: data || {},
    };

    console.log("🚀 Enviando a OneSignal:", JSON.stringify(payload, null, 2));

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${onesignalApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("📡 Respuesta de OneSignal:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error("❌ Error de OneSignal API:", result);
      return new Response(JSON.stringify({ success: false, error: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: response.status
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    console.error("🔥 Error crítico en Edge Function:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    })
  }
})

