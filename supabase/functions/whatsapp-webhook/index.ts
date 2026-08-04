import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Manejar preflight de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  // 1. VERIFICACIÓN DEL WEBHOOK DE META (GET)
  if (req.method === "GET") {
    console.log("Petición de verificación del webhook recibida.");
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "wepi_valida_token_2026";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook validado con éxito. Enviando challenge...");
      return new Response(challenge, {
        status: 200,
        headers: { 
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    
    console.error("Error en validación. Token provisto:", token, "Token esperado:", VERIFY_TOKEN);
    return new Response("Forbidden", { status: 403 });
  }

  // 2. RECEPCIÓN DE MENSAJES DE WHATSAPP (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Webhook POST recibido. Payload completo:", JSON.stringify(body));

      // A0. MANEJO DE ENVÍO DIRECTO DE PLANTILLAS META API (HSM) COMO "sin_repartidores"
      if (body?.action === 'send_template') {
        const { to, templateName = 'sin_repartidores', languageCode = 'es_AR', phoneId, components } = body;
        const accessToken = Deno.env.get("META_ACCESS_TOKEN");
        const targetPhoneId = phoneId || Deno.env.get("META_PHONE_NUMBER_ID");

        if (!to) {
          return new Response(JSON.stringify({ error: "Falta el parámetro 'to' con el teléfono." }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        const payload: any = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: String(to).replace(/\D/g, ''),
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode }
          }
        };

        if (components && Array.isArray(components)) {
          payload.template.components = components;
        }

        console.log(`[Meta HSM] Enviando plantilla '${templateName}' a ${to}...`);
        const metaResponse = await callMetaAPI(targetPhoneId, payload, accessToken);

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Plantilla ${templateName} procesada`,
          metaResponse 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const field = changes?.field;
      const value = changes?.value;

      // MODO COEXISTENCIA: Ignorar "echoes" (mensajes que el comerciante envía a mano desde su celular)
      if (field === 'smb_message_echoes' || value?.statuses || value?.smb_message_echoes || value?.message_echoes) {
        console.log("Evento de coexistencia / respuesta manual detectado (echo). Guardando silencio.");
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const message = value?.messages?.[0];
      const metadata = value?.metadata;

      // Asegurarse de que sea una notificación de mensaje entrante
      if (message) {
        const from = message.from; // Celular del cliente
        const phoneId = metadata?.phone_number_id; // ID del número del comercio en Meta

        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // A. Buscar el comercio en la base de datos por whatsapp_phone_id
        let local: any = null;
        if (phoneId && phoneId !== '3756543670' && phoneId !== 'global' && phoneId !== 'main_bot') {
          try {
            const { data, error } = await supabase
              .from('locales')
              .select('id, nombre, ciudad, slug, whatsapp_phone_id, whatsapp_access_token')
              .eq('whatsapp_phone_id', phoneId)
              .maybeSingle();

            if (!error && data) {
              local = data;
            }
          } catch (e: any) {
            console.warn("Error consultando local por whatsapp_phone_id:", e.message);
          }
        }

        // A2. Obtener el Token de Acceso (Access Token)
        const accessToken = local?.whatsapp_access_token || Deno.env.get("META_ACCESS_TOKEN");

        // B. SI NO ES UN COMERCIO INDIVIDUAL ESPECÍFICO, TRATAR COMO BOT GLOBAL DE WEPI (3756543670)
        if (!local) {
          console.log("Mensaje para Wepi Bot Global (3756543670). Procesando flujo configurado de /admin...");
          const textContent = message.text?.body || message.interactive?.button_reply?.id || '';
          await enviarRespuestaWepiBotGlobal(from, phoneId, textContent, supabase, accessToken);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // C. Detectar el tipo de interacción para Comercios Individuales (Wepi Assistant)
        const messageType = message.type;
        console.log(`Mensaje recibido de ${from}. Tipo: ${messageType}. Local: ${local.nombre}`);

        if (messageType === "interactive") {
          const interactiveType = message.interactive?.type;
          
          if (interactiveType === "button_reply") {
            const buttonId = message.interactive.button_reply.id;
            console.log(`Botón presionado: ${buttonId}`);
            
            if (buttonId === "buscar_categoria") {
              await enviarListaCategorias(from, phoneId, local, supabase, accessToken);
            } else if (buttonId === "ver_menu_completo") {
              await enviarLinkMenuCompleto(from, phoneId, local, supabase, accessToken);
            }
          } else if (interactiveType === "list_reply") {
            const selectionId = message.interactive.list_reply.id;
            console.log(`Opción de lista seleccionada: ${selectionId}`);
            
            if (selectionId === "cat_ver_todo") {
              await enviarLinkMenuCompleto(from, phoneId, local, supabase, accessToken);
            } else {
              const categoria = selectionId.replace("cat_", "");
              await enviarLinkCategoria(from, phoneId, local, categoria, supabase, accessToken);
            }
          }
        } else {
          // Texto regular para un comercio individual
          await enviarMensajeBienvenida(from, phoneId, local.nombre, local.id, supabase, accessToken);
        }
      }

      return new Response("EVENT_RECEIVED", { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("Error al procesar el webhook de WhatsApp:", err);
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
});

// ─────────────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES PARA ENVIAR LLAMADAS A LA API DE META
// ─────────────────────────────────────────────────────────────────

async function callMetaAPI(phoneId: string, payload: any, accessToken?: string, localId?: string, supabase?: any) {
  const token = accessToken || Deno.env.get("META_ACCESS_TOKEN");
  if (!token) {
    console.error("No hay Token de Acceso de Meta disponible.");
    return { error: "No hay Token de Acceso de Meta" };
  }

  const activePhoneId = phoneId || Deno.env.get("META_PHONE_NUMBER_ID");
  if (!activePhoneId) {
    console.error("No hay Phone Number ID de Meta disponible.");
    return { error: "No hay Phone Number ID de Meta" };
  }

  if (payload?.to) {
    payload.to = payload.to.replace(/\D/g, '');
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${activePhoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("Respuesta de la API de Meta:", JSON.stringify(data));

    if (localId && supabase && data?.messages?.[0]?.id) {
      await supabase.rpc('increment_whatsapp_messages', { local_id: localId });
    }
    
    return data;
  } catch (err: any) {
    console.error("Error in callMetaAPI:", err);
    return { error: err.message };
  }
}

async function enviarMensajeBienvenida(to: string, phoneId: string, nombreComercio: string, localId?: string, supabase?: any, accessToken?: string) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { 
        text: `¡Hola! 👋 Soy *Wepi Assistant*.\n\nTe ayudo a pedir en *${nombreComercio}*.\n\n¿Qué querés hacer?` 
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "buscar_categoria",
              title: "🔍 Buscar categoría"
            }
          },
          {
            type: "reply",
            reply: {
              id: "ver_menu_completo",
              title: "📋 Menú completo"
            }
          }
        ]
      }
    }
  };

  await callMetaAPI(phoneId, payload, accessToken, localId, supabase);
}

async function enviarListaCategorias(to: string, phoneId: string, local: any, supabase: any, accessToken?: string) {
  const { data: menuItems, error } = await supabase
    .from('menu')
    .select('categoria')
    .eq('local_id', local.id)
    .eq('disponible', true);

  if (error || !menuItems || menuItems.length === 0) {
    console.log("No se encontraron categorías activas. Enviando al menú completo.");
    await enviarLinkMenuCompleto(to, phoneId, local, supabase, accessToken);
    return;
  }

  const counts: Record<string, number> = {};
  menuItems.forEach((item: any) => {
    if (item.categoria) {
      counts[item.categoria] = (counts[item.categoria] || 0) + 1;
    }
  });

  const categoriasPrincipales = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 4);

  if (categoriasPrincipales.length === 0) {
    await enviarLinkMenuCompleto(to, phoneId, local, supabase, accessToken);
    return;
  }

  const rows = categoriasPrincipales.map(cat => ({
    id: `cat_${cat.toLowerCase().replace(/\s+/g, '_')}`,
    title: cat.substring(0, 24),
    description: `Ver opciones de ${cat.substring(0, 50)}`
  }));

  rows.push({
    id: "cat_ver_todo",
    title: "📋 Ver todo el catálogo",
    description: "Ir al menú general del local"
  });

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "Wepi Assistant"
      },
      body: { 
        text: "Elegí una categoría para ver los productos destacados 👇" 
      },
      action: {
        button: "Ver Categorías",
        sections: [
          {
            title: "Categorías del Comercio",
            rows: rows
          }
        ]
      }
    }
  };

  await callMetaAPI(phoneId, payload, accessToken, local.id, supabase);
}

async function enviarLinkCategoria(to: string, phoneId: string, local: any, categoria: string, supabase: any, accessToken?: string) {
  const ciudadSlug = local.ciudad ? local.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-') : 'obera';
  const localSlug = local.slug || 'local';
  
  const url = `https://wepi.com.ar/pedir/${ciudadSlug}/${localSlug}?categoria=${encodeURIComponent(categoria)}&utm_source=wa_bot`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "text",
    text: {
      preview_url: true,
      body: `Encontrá las mejores opciones de *${categoria.toUpperCase()}* en *${local.nombre}* haciendo clic en el siguiente enlace 👇\n\n🔗 ${url}\n\n_Elegí tus productos y confirmá el pedido en nuestra web._`
    }
  };

  await callMetaAPI(phoneId, payload, accessToken, local.id, supabase);
}

async function enviarLinkMenuCompleto(to: string, phoneId: string, local: any, supabase: any, accessToken?: string) {
  const ciudadSlug = local.ciudad ? local.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-') : 'obera';
  const localSlug = local.slug || 'local';

  const url = `https://wepi.com.ar/pedir/${ciudadSlug}/${localSlug}?utm_source=wa_bot`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "text",
    text: {
      preview_url: true,
      body: `Mirá el menú completo de *${local.nombre}* haciendo clic en el siguiente enlace 👇\n\n🔗 ${url}\n\n_Podés elegir tus productos, pagar y solicitar el envío desde nuestra plataforma._`
    }
  };

  await callMetaAPI(phoneId, payload, accessToken, local.id, supabase);
}

async function enviarRespuestaWepiBotGlobal(to: string, phoneId: string, text: string, supabase: any, accessToken?: string) {
  let flowData: any = null;
  let supportPhone = '3756543610';

  try {
    const { data } = await supabase.from('whatsapp_bot_flows').select('flow_data, support_phone').eq('id', 'main_flow').maybeSingle();
    if (data?.flow_data) {
      flowData = data.flow_data;
      if (data.support_phone) supportPhone = data.support_phone;
    }
  } catch (e) {}

  if (!flowData) {
    try {
      const { data } = await supabase.from('configuracion').select('whatsapp_bot_flows').eq('id', 'global').maybeSingle();
      if (data?.whatsapp_bot_flows) flowData = data.whatsapp_bot_flows;
    } catch (e) {}
  }

  const cleanText = (text || '').toLowerCase().trim();

  let bodyText = '';

  if (cleanText === '1' || cleanText.includes('pedir') || cleanText.includes('hacer un pedido') || cleanText.includes('carta')) {
    bodyText = (flowData?.hacer_pedido?.mensaje || '🍔 Elegí tu ciudad.\n(O usar ubicación)') + '\n\n' +
      '• Santo Tomé: https://wepi.com.ar/pedir/santo-tome\n' +
      '• Oberá: https://wepi.com.ar/pedir/obera\n' +
      '• Apóstoles: https://wepi.com.ar/pedir/apostoles\n' +
      '• Alem: https://wepi.com.ar/pedir/alem\n' +
      '• Goya: https://wepi.com.ar/pedir/goya\n\n' +
      (flowData?.hacer_pedido?.footer || '↓\nAbrí Wepi y hacé tu pedido 👇\nhttps://wepi.com.ar/pedir/');
  } else if (cleanText === '2' || cleanText.includes('estado')) {
    bodyText = flowData?.estado_pedido?.mensaje || '📦 Podés consultar el estado de tu pedido aquí:\nhttps://wepi.com.ar/mis-pedidos';
  } else if (cleanText === '3' || cleanText === '4' || cleanText.includes('soporte') || cleanText.includes('humano') || cleanText.includes('agente') || cleanText.includes('hablar')) {
    bodyText = flowData?.soporte?.mensaje || `👨 Te estamos conectando con un agente de soporte de Wepi.\n\nHacé clic en el siguiente enlace para chatear con un representante:\nhttps://wa.me/549${supportPhone}`;
  } else {
    // Mensaje de saludo de bienvenida inicial + Opciones 1, 2, 3
    let defaultOpts = `1️⃣ 🍔 Hacer un pedido\n2️⃣ 📦 Estado de mi pedido\n3️⃣ 👨 Hablar con soporte`;
    let mainHeader = flowData?.inicio?.mensaje || `👋 ¡Hola! Soy Wepi Bot.\n\n¿En qué puedo ayudarte?`;
    let optsText = '';

    if (Array.isArray(flowData?.inicio?.opciones) && flowData.inicio.opciones.length > 0) {
      optsText = flowData.inicio.opciones.map((o: any) => o.label || o.titulo || o.text).filter(Boolean).join('\n');
    }

    if (!optsText) {
      optsText = defaultOpts;
    }

    if (mainHeader.includes('1️⃣') || mainHeader.includes('Hacer un pedido')) {
      bodyText = mainHeader;
    } else {
      bodyText = `${mainHeader}\n\n${optsText}`;
    }
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "text",
    text: { body: bodyText }
  };

  await callMetaAPI(phoneId, payload, accessToken);
}

