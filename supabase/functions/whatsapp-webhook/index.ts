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

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      const metadata = value?.metadata;

      // Asegurarse de que sea una notificación de mensaje entrante (no una actualización de estado de entrega)
      if (message) {
        const from = message.from; // Celular del cliente
        const phoneId = metadata?.phone_number_id; // ID del número del comercio en Meta

        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // A. Buscar el comercio en la base de datos por whatsapp_phone_id
        let local = null;
        try {
          const { data, error } = await supabase
            .from('locales')
            .select('id, nombre, ciudad, slug, whatsapp_phone_id')
            .eq('whatsapp_phone_id', phoneId)
            .maybeSingle();

          if (!error && data) {
            local = data;
          }
        } catch (e) {
          console.warn("La columna whatsapp_phone_id no existe o arrojó un error:", e.message);
        }

        // B. FALLBACK DE PRUEBAS: Si no se encuentra el comercio por ID de WhatsApp (o la columna no existe),
        // vinculamos por defecto a "Pepes Take Away" (slug: pepes-takeaway) para habilitar el testing inmediato.
        if (!local) {
          console.log("Usando local de pruebas por defecto: Pepes Take Away.");
          const { data: defaultLocal } = await supabase
            .from('locales')
            .select('id, nombre, ciudad, slug')
            .eq('id', 'LOC-1774567661603')
            .single();
          local = defaultLocal;
        }

        if (!local) {
          console.error("No se pudo obtener ningún local de la base de datos.");
          return new Response("Local no encontrado", { status: 200 });
        }

        // C. Detectar el tipo de interacción
        const messageType = message.type;
        console.log(`Mensaje recibido de ${from}. Tipo: ${messageType}. Local: ${local.nombre}`);

        if (messageType === "interactive") {
          const interactiveType = message.interactive?.type;
          
          if (interactiveType === "button_reply") {
            const buttonId = message.interactive.button_reply.id;
            console.log(`Botón presionado: ${buttonId}`);
            
            if (buttonId === "buscar_categoria") {
              await enviarListaCategorias(from, phoneId, local, supabase);
            } else if (buttonId === "ver_menu_completo") {
              await enviarLinkMenuCompleto(from, phoneId, local);
            }
          } else if (interactiveType === "list_reply") {
            const selectionId = message.interactive.list_reply.id;
            console.log(`Opción de lista seleccionada: ${selectionId}`);
            
            if (selectionId === "cat_ver_todo") {
              await enviarLinkMenuCompleto(from, phoneId, local);
            } else {
              const categoria = selectionId.replace("cat_", "");
              await enviarLinkCategoria(from, phoneId, local, categoria);
            }
          }
        } else {
          // Cualquier texto regular (ej: "Hola", "Menú", etc.) envía el mensaje de bienvenida con botones
          await enviarMensajeBienvenida(from, phoneId, local.nombre);
        }
      }

      return new Response("EVENT_RECEIVED", { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
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

async function callMetaAPI(phoneId: string, payload: any) {
  // META_ACCESS_TOKEN configurada en las variables de entorno de Supabase
  const token = Deno.env.get("META_ACCESS_TOKEN");
  if (!token) {
    console.error("META_ACCESS_TOKEN no está configurada en las variables de entorno de Supabase.");
    return;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("Respuesta de la API de Meta:", JSON.stringify(data));
  } catch (err) {
    console.error("Error llamando a la API de Meta:", err);
  }
}

async function enviarMensajeBienvenida(to: string, phoneId: string, nombreComercio: string) {
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

  await callMetaAPI(phoneId, payload);
}

async function enviarListaCategorias(to: string, phoneId: string, local: any, supabase: any) {
  // 1. Consultar el menú del comercio
  const { data: menuItems, error } = await supabase
    .from('menu')
    .select('categoria')
    .eq('local_id', local.id)
    .eq('disponible', true);

  if (error || !menuItems || menuItems.length === 0) {
    console.log("No se encontraron categorías activas. Enviando al menú completo.");
    await enviarLinkMenuCompleto(to, phoneId, local);
    return;
  }

  // 2. Agrupar y obtener las 4 categorías con más productos
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
    await enviarLinkMenuCompleto(to, phoneId, local);
    return;
  }

  // 3. Crear las filas de la lista de WhatsApp
  const rows = categoriasPrincipales.map(cat => ({
    id: `cat_${cat.toLowerCase().replace(/\s+/g, '_')}`,
    title: cat.substring(0, 24), // Límite de Meta: 24 caracteres
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

  await callMetaAPI(phoneId, payload);
}

async function enviarLinkCategoria(to: string, phoneId: string, local: any, categoria: string) {
  // Asegurarnos de usar slugs válidos de la ciudad
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

  await callMetaAPI(phoneId, payload);
}

async function enviarLinkMenuCompleto(to: string, phoneId: string, local: any) {
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

  await callMetaAPI(phoneId, payload);
}
