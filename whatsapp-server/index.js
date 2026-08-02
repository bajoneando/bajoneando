const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno del directorio padre para reutilizar las claves de Supabase
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 
                    process.env.VITE_SUPABASE_URL || 
                    'https://jskxfescamdjesdrcnkf.supabase.co';
                    
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.SUPABASE_ANON_KEY || 
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(supabaseUrl, supabaseKey);

// Estructura en memoria para almacenar las sesiones de los comercios
const sessions = new Map();

// Asegurar que la carpeta de almacenamiento de credenciales exista
const authFolder = path.join(__dirname, 'auth_info');
if (!fs.existsSync(authFolder)) {
  fs.mkdirSync(authFolder);
}

// ─────────────────────────────────────────────────────────────────
// CONTROLADOR DE SESIONES WHATSAPP (BAILEYS)
// ─────────────────────────────────────────────────────────────────

const MAX_RETRIES = 5; // Máximo de reintentos antes de detenerse

async function initSession(localId, retryCount = 0) {
  if (sessions.has(localId)) {
    const session = sessions.get(localId);
    if (session.status !== 'disconnected' && session.status !== 'error') {
      return session;
    }
  }

  // Guardar un placeholder en memoria de forma SÍNCRONA antes de cualquier await para evitar llamadas concurrentes
  const sessionObj = {
    sock: null,
    status: 'loading',
    qr: null,
    phoneNumber: null,
    errorMessage: null
  };
  sessions.set(localId, sessionObj);

  console.log(`[Session Manager] Inicializando sesión para localId: ${localId} (intento ${retryCount + 1}/${MAX_RETRIES})`);
  const localAuthPath = path.join(authFolder, localId);
  
  let state, saveCreds;
  try {
    const authState = await useMultiFileAuthState(localAuthPath);
    state = authState.state;
    saveCreds = authState.saveCreds;
  } catch (err) {
    console.error(`[Session Manager] Error al leer credenciales para localId ${localId}:`, err);
    sessions.delete(localId);
    return null;
  }

  // Obtener la versión más reciente de WhatsApp Web con timeout para evitar bloqueos
  let version;
  try {
    const versionResult = await Promise.race([
      fetchLatestWaWebVersion({}),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    version = versionResult.version;
    console.log(`[Session Manager] Usando versión de WhatsApp Web: ${version.join('.')}`);
  } catch (err) {
    console.warn('[Session Manager] No se pudo obtener la versión en tiempo real, usando la versión por defecto de Baileys.');
    version = undefined; // Baileys usará su versión interna por defecto
  }
  
  const socketConfig = {
    auth: state,
    logger: pino({ level: 'silent' }), // Evita spam de logs en la consola
    printQRInTerminal: false,
    browser: ['Wepi', 'Chrome', '127.0.0.1'], // Identidad de navegador para evitar rechazo 405
  };
  if (version) socketConfig.version = version;

  const sock = makeWASocket(socketConfig);

  sessionObj.sock = sock;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Convertir el QR de texto en una imagen base64 para el frontend
      try {
        const qrImage = await QRCode.toDataURL(qr);
        sessionObj.status = 'qr_ready';
        sessionObj.qr = qrImage;
        sessionObj.errorMessage = null;
        console.log(`[Session Manager] QR listo para el local ${localId}`);
      } catch (err) {
        console.error('Error al generar código QR:', err);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[Session Manager] Conexión cerrada para local ${localId}. Código: ${statusCode}. Reconectar: ${shouldReconnect}`, lastDisconnect?.error?.message);
      
      sessionObj.qr = null;

      if (shouldReconnect && retryCount < MAX_RETRIES) {
        // Intentar reconectar con backoff exponencial (5s, 10s, 20s, 40s, 80s)
        const delay = 5000 * Math.pow(2, retryCount);
        console.log(`[Session Manager] Reintentando en ${delay / 1000}s... (intento ${retryCount + 1}/${MAX_RETRIES})`);
        sessionObj.status = 'loading';
        setTimeout(() => initSession(localId, retryCount + 1), delay);
      } else if (shouldReconnect) {
        // Se agotaron los reintentos
        console.error(`[Session Manager] Se agotaron los ${MAX_RETRIES} reintentos para local ${localId}. Error 405: WhatsApp rechazó la conexión.`);
        sessionObj.status = 'error';
        sessionObj.errorMessage = 'No se pudo conectar a WhatsApp después de varios intentos. Intenta nuevamente más tarde.';
        // Limpiar credenciales corruptas para la siguiente vez
        try {
          fs.rmSync(localAuthPath, { recursive: true, force: true });
        } catch (e) { /* ignorar */ }
      } else {
        // Si el usuario cerró sesión en el celular, borramos la carpeta de credenciales
        console.log(`[Session Manager] Sesión cerrada permanentemente por el usuario. Limpiando datos.`);
        sessionObj.status = 'disconnected';
        sessions.delete(localId);
        try {
          fs.rmSync(localAuthPath, { recursive: true, force: true });
          
          // Actualizar base de datos: desactivar asistente
          await supabase.from('locales').update({
            whatsapp_assistant_enabled: false,
            whatsapp_phone_number: null
          }).eq('id', localId);
        } catch (e) {
          console.error("Error al limpiar archivos de sesión:", e);
        }
      }
    } else if (connection === 'open') {
      console.log(`[Session Manager] Conexión abierta con éxito para local ${localId}`);
      
      const rawNumber = sock.user.id.split(':')[0];
      sessionObj.status = 'connected';
      sessionObj.qr = null;
      sessionObj.phoneNumber = `+${rawNumber}`;

      // Guardar el estado activo en la base de datos de Supabase solo si es un comercio individual
      if (localId !== 'global' && localId !== 'main_bot' && localId !== '3756543670' && !rawNumber.includes('3756543670')) {
        try {
          await supabase.from('locales').update({
            whatsapp_assistant_enabled: true,
            whatsapp_phone_number: sessionObj.phoneNumber,
            whatsapp_phone_id: 'baileys_session' // Indicador de que usa QR
          }).eq('id', localId);
          console.log(`[Supabase] Estado del bot de comercio guardado para local ${localId}`);
        } catch (err) {
          console.error('Error actualizando Supabase con el número vinculado:', err);
        }
      } else {
        console.log(`[Supabase] Bot global de Wepi (${sessionObj.phoneNumber}) conectado correctamente.`);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Escuchar mensajes entrantes
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    
    for (const msg of m.messages) {
      if (!msg.message) continue;
      
      const from = msg.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      const isMe = msg.key.fromMe;

      // Ignorar grupos y mensajes enviados por el propio bot
      if (isGroup || isMe) continue;

      try {
        // Enviar recibo de lectura (Read Receipt) para simular que abrimos el chat
        await sock.readMessages([msg.key]);
        
        await handleIncomingMessage(localId, sock, from, msg);
      } catch (err) {
        console.error(`Error procesando mensaje entrante de ${from}:`, err);
      }
    }
  });

  return sessionObj;
}

// Enviar mensaje simulando escritura humana y con retraso aleatorio (Anti-Ban)
async function sendSmartMessage(localId, sock, to, content) {
  try {
    // 1. Mostrar estado "Escribiendo..." (composing)
    await sock.sendPresenceUpdate('composing', to);
    
    // 2. Calcular retraso proporcional a la longitud del texto
    const textLength = content.text ? content.text.length : 100;
    // Velocidad de escritura promedio: ~10ms por caracter + pausa humana aleatoria de 1s a 2s
    const baseDelay = textLength * 10;
    const randomDelay = Math.floor(Math.random() * 1000) + 1000;
    // Margen de seguridad: Entre 1.5s y 5.0s
    const finalDelay = Math.min(5000, Math.max(1500, baseDelay + randomDelay));
    
    await new Promise(resolve => setTimeout(resolve, finalDelay));
    
    // 3. Detener estado "Escribiendo..." y enviar el mensaje
    await sock.sendPresenceUpdate('paused', to);
    await sock.sendMessage(to, content);

    // 4. Incrementar de forma atómica el contador de mensajes de WhatsApp enviados
    if (localId) {
      supabase.rpc('increment_whatsapp_messages', { local_id: localId })
        .then(({ error }) => {
          if (error) console.error(`[Metrics] Error incrementando whatsapp_messages_sent para ${localId}:`, error);
        });
    }
  } catch (err) {
    console.error(`Error al enviar mensaje inteligente a ${to}:`, err);
  }
}

function matchesKeywords(text, keywordsInput, defaultArray = []) {
  if (!text) return false;
  let kwList = [];
  if (Array.isArray(keywordsInput)) {
    kwList = keywordsInput;
  } else if (typeof keywordsInput === 'string' && keywordsInput.trim()) {
    kwList = keywordsInput.split(',').map(k => k.trim());
  } else if (Array.isArray(defaultArray)) {
    kwList = defaultArray;
  }
  
  const cleanText = text.toLowerCase().trim();
  return kwList.some(kw => {
    const cleanKw = kw.toLowerCase().trim();
    if (!cleanKw) return false;
    return cleanText === cleanKw || cleanText.includes(cleanKw);
  });
}

// ─────────────────────────────────────────────────────────────────
// PROCESAMIENTO DE MENSAJES ENTRANTES
// ─────────────────────────────────────────────────────────────────

async function handleIncomingMessage(localId, sock, from, msg) {
  // Obtener texto del mensaje
  let text = '';
  if (msg.message.conversation) {
    text = msg.message.conversation;
  } else if (msg.message.extendedTextMessage?.text) {
    text = msg.message.extendedTextMessage.text;
  }

  text = text.trim().toLowerCase();
  if (!text) return;

  const botPhoneNumber = sock?.user?.id ? sock.user.id.split(':')[0] : '';
  const isGlobalWepiBot = localId === 'global' || 
                          localId === 'main_bot' || 
                          localId === '3756543670' || 
                          localId.includes('3756543670') || 
                          botPhoneNumber.includes('3756543670');

  console.log(`[Bot ${localId}] Mensaje recibido de ${from}: "${text}" (isGlobalWepiBot: ${isGlobalWepiBot})`);

  // Manejo exclusivo del bot global de Wepi (3756543670) -> Flujos de /admin
  if (isGlobalWepiBot) {
    const { data: flowRow } = await supabase
      .from('whatsapp_bot_flows')
      .select('flow_data, support_phone')
      .eq('id', 'main_flow')
      .maybeSingle();

    const flows = flowRow?.flow_data || {};
    const supportPhone = flowRow?.support_phone || '3756543610';

    const kwPedido = flows.hacer_pedido?.keywords || flows.inicio?.opciones?.find(o => o.action === 'hacer_pedido')?.keywords;
    const kwEstado = flows.estado_pedido?.keywords || flows.inicio?.opciones?.find(o => o.action === 'estado_pedido')?.keywords;
    const kwAyuda = flows.ayuda?.keywords || flows.inicio?.opciones?.find(o => o.action === 'ayuda')?.keywords;
    const kwSoporte = flows.soporte?.keywords || flows.inicio?.opciones?.find(o => o.action === 'soporte')?.keywords;

    const subPagar = flows.ayuda?.opciones?.find(o => o.key === '1');
    const subSeguir = flows.ayuda?.opciones?.find(o => o.key === '2');
    const subClave = flows.ayuda?.opciones?.find(o => o.key === '3');
    const subSoporte = flows.ayuda?.opciones?.find(o => o.key === '4');

    if (matchesKeywords(text, kwPedido, ['1', 'pedir', 'hacer un pedido', 'carta', 'menu', 'comprar'])) {
      const msgText = (flows.hacer_pedido?.mensaje || '🍔 Elegí tu ciudad.\n(O usar ubicación)') + '\n\n' +
        '• Santo Tomé: https://wepi.com.ar/pedir/santo-tome\n' +
        '• Oberá: https://wepi.com.ar/pedir/obera\n' +
        '• Apóstoles: https://wepi.com.ar/pedir/apostoles\n' +
        '• Alem: https://wepi.com.ar/pedir/alem\n' +
        '• Goya: https://wepi.com.ar/pedir/goya\n\n' +
        (flows.hacer_pedido?.footer || '↓\nAbrí Wepi y hacé tu pedido 👇\nhttps://wepi.com.ar/pedir/');
      await sendSmartMessage(localId, sock, from, { text: msgText });
    } else if (matchesKeywords(text, kwEstado, ['2', 'estado', 'mi pedido', 'donde esta', 'seguimiento'])) {
      const msgText = flows.estado_pedido?.mensaje || '📦 Podés consultar el estado de tu pedido aquí:\nhttps://wepi.com.ar/mis-pedidos';
      await sendSmartMessage(localId, sock, from, { text: msgText });
    } else if (matchesKeywords(text, subPagar?.keywords, ['1', '3.1', '31', 'pagar', 'pago', 'efectivo', 'mercadopago', 'tarjeta'])) {
      const ans = subPagar?.respuesta || 
        "💳 *Métodos de pago en Wepi*:\n\nPodés pagar en efectivo al recibir, con transferencia o mediante tarjeta/Mercado Pago desde la web. También podés utilizar tu saldo de Wepi Wallet.";
      await sendSmartMessage(localId, sock, from, { text: ans });
    } else if (matchesKeywords(text, subSeguir?.keywords, ['2', '3.2', '32', 'seguir', 'seguimiento', 'mapa'])) {
      const ans = subSeguir?.respuesta || 
        "📍 *Seguimiento de pedidos*:\n\nIngresá a https://wepi.com.ar/mis-pedidos para ver el estado de tu pedido en vivo.";
      await sendSmartMessage(localId, sock, from, { text: ans });
    } else if (matchesKeywords(text, subClave?.keywords, ['3', '3.3', '33', 'contraseña', 'clave', 'password'])) {
      const ans = subClave?.respuesta || 
        "🔑 *Recuperar contraseña*:\n\nAl iniciar sesión en Wepi, elegí la opción '¿Olvidaste tu contraseña?' e ingresá tu email.";
      await sendSmartMessage(localId, sock, from, { text: ans });
    } else if (matchesKeywords(text, subSoporte?.keywords, ['3.4', '34']) || matchesKeywords(text, kwSoporte, ['4', 'soporte', 'humano', 'agente'])) {
      const msgText = `👨 Te estamos conectando con un agente de soporte de Wepi.\n\nHacé clic en el siguiente enlace para chatear con un representante:\nhttps://wa.me/549${supportPhone}`;
      await sendSmartMessage(localId, sock, from, { text: msgText });
    } else if (matchesKeywords(text, kwAyuda, ['3', 'ayuda', 'duda', 'faq'])) {
      const msgText = (flows.ayuda?.mensaje || '¿Sobre qué necesitás ayuda?') + '\n\n' +
        `1️⃣ 💳 Cómo pagar\n` +
        `2️⃣ 📍 Cómo seguir mi pedido\n` +
        `3️⃣ 🔑 Recuperar contraseña\n` +
        `4️⃣ 📞 Hablar con soporte`;
      await sendSmartMessage(localId, sock, from, { text: msgText });
    } else {
      const msgText = flows.inicio?.mensaje || `👋 ¡Hola! Soy Wepi Bot.\n\n¿En qué puedo ayudarte?\n\n1️⃣ 🍔 Hacer un pedido\n2️⃣ 📦 Estado de mi pedido\n3️⃣ ❓ Ayuda\n4️⃣ 👨 Hablar con soporte`;
      await sendSmartMessage(localId, sock, from, { text: msgText });
    }
    return;
  }

  // 1. Obtener la información del local desde Supabase
  const { data: local, error: localErr } = await supabase
    .from('locales')
    .select('id, nombre, ciudad, slug, direccion, horario_apertura, horario_cierre, acepta_retiro, acepta_envio')
    .eq('id', localId)
    .single();

  if (localErr || !local) {
    console.error(`[Bot ${localId}] No se pudo cargar la info del local de Supabase.`);
    return;
  }

  // Slugs para links de Wepi
  const ciudadSlug = local.ciudad ? local.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-') : 'obera';
  const localSlug = local.slug || 'local';
  const baseUrl = `https://wepi.com.ar/pedir/${ciudadSlug}/${localSlug}`;

  // 2. Comportamiento conversacional basado en la entrada
  if (text === '2' || text.includes('categoria') || text.includes('rubro')) {
    // Listar categorías destacadas de la base de datos
    const { data: menuItems } = await supabase
      .from('menu')
      .select('categoria')
      .eq('local_id', localId)
      .eq('disponible', true);

    const counts = {};
    (menuItems || []).forEach(item => {
      if (item.categoria) counts[item.categoria] = (counts[item.categoria] || 0) + 1;
    });

    const topCategories = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 5);

    if (topCategories.length === 0) {
      await sendSmartMessage(localId, sock, from, {
        text: `¡Hola! Podés ver todo nuestro catálogo ingresando directamente a nuestra web aquí:\n🔗 ${baseUrl}?utm_source=wa_bot`
      });
      return;
    }

    let menuText = `*🔍 Categorías Disponibles en ${local.nombre}*:\n\n`;
    topCategories.forEach((cat, index) => {
      const catUrl = `${baseUrl}?categoria=${encodeURIComponent(cat)}&utm_source=wa_bot`;
      menuText += `${index + 1}️⃣ *${cat.toUpperCase()}*\n👉 Ver opciones: ${catUrl}\n\n`;
    });
    
    menuText += `📋 *Ver Menú Completo*:\n🔗 ${baseUrl}?utm_source=wa_bot`;

    await sendSmartMessage(localId, sock, from, { text: menuText });

  } else if (text === '1' || text.includes('carta') || text.includes('menu') || text.includes('catálogo')) {
    // Enviar link del menú completo
    const responseText = `¡Perfecto! Aquí tenés el menú completo de *${local.nombre}* para elegir lo que quieras 👇\n\n🔗 ${baseUrl}?utm_source=wa_bot\n\n_Sumá tus productos al carrito y finalizá el pedido desde la web de forma simple._`;
    await sendSmartMessage(localId, sock, from, { text: responseText });

  } else if (text === '3' || text.includes('info') || text.includes('horario') || text.includes('donde') || text.includes('ubicacion') || text.includes('direcci')) {
    // Enviar información y horarios del local
    const infoDetails = [];
    
    if (local.direccion) {
      infoDetails.push(`📍 *Dirección:* ${local.direccion}`);
    }
    
    if (local.horario_apertura && local.horario_cierre) {
      infoDetails.push(`🕒 *Horarios hoy:* Abierto de ${local.horario_apertura} a ${local.horario_cierre} hs.`);
    } else {
      infoDetails.push(`🕒 *Horarios:* Consultá nuestros horarios abriendo el menú online.`);
    }

    const metodos = [];
    if (local.acepta_envio !== false) metodos.push('🛵 Envío a domicilio');
    if (local.acepta_retiro !== false) metodos.push('🏪 Retiro en local');
    
    if (metodos.length > 0) {
      infoDetails.push(`💳 *Servicios:* ${metodos.join(' | ')}`);
    }

    const infoText = `*ℹ️ Información sobre ${local.nombre}*:\n\n` + 
                     infoDetails.join('\n\n') + 
                     `\n\n🔗 *Hacé tu pedido online ingresando aquí:* \n${baseUrl}?utm_source=wa_bot`;
                     
    await sendSmartMessage(localId, sock, from, { text: infoText });

  } else {
    // Mensaje de saludo de bienvenida inicial (Cualquier otro texto)
    const welcomeText = `¡Hola! 👋 Soy *Wepi Assistant*, el asistente virtual de *${local.nombre}*.\n\nTe ayudo a hacer tu pedido más rápido. ¿Qué querés hacer hoy? \n\n1️⃣ *Ver el Menú Completo* (Abrir catálogo digital)\n2️⃣ *Buscar por Categorías* (Pizzas, Hamburguesas, etc.)\n3️⃣ *Información y Horarios* (Ubicación, entrega, horarios)\n\n_Respondé con el número *1*, *2* o *3* para continuar._`;
    await sendSmartMessage(localId, sock, from, { text: welcomeText });
  }
}

// ─────────────────────────────────────────────────────────────────
// ENDPOINTS DE LA API EXPRESS
// ─────────────────────────────────────────────────────────────────

// Obtener el estado actual de la sesión del WhatsApp de un local
app.get('/api/status', async (req, res) => {
  const { localId } = req.query;
  if (!localId) {
    return res.status(400).json({ error: 'Falta el parámetro localId' });
  }

  let session = sessions.get(localId);

  // Si no está cargada en memoria, pero la carpeta de credenciales existe,
  // significa que el servidor se reinició pero ya estaba conectada. La inicializamos.
  const localAuthPath = path.join(authFolder, localId);
  if (!session && fs.existsSync(localAuthPath)) {
    session = await initSession(localId);
  }

  if (!session) {
    return res.json({ status: 'disconnected', qr: null, phoneNumber: null });
  }

  res.json({
    status: session.status,
    qr: session.qr,
    phoneNumber: session.phoneNumber,
    errorMessage: session.errorMessage || null
  });
});

// Iniciar proceso de vinculación (Generar QR o reconectar)
app.post('/api/connect', async (req, res) => {
  const { localId } = req.body;
  if (!localId) {
    return res.status(400).json({ error: 'Falta el parámetro localId' });
  }

  try {
    // Inicializar sesión en segundo plano para evitar timeouts HTTP en el cliente
    initSession(localId).catch(err => {
      console.error(`[Session Manager] Error asíncrono iniciando sesión para local ${localId}:`, err);
    });

    res.json({
      status: 'loading',
      qr: null,
      phoneNumber: null
    });
  } catch (err) {
    console.error('Error al inicializar sesión:', err);
    res.status(500).json({ error: 'Error interno al conectar' });
  }
});

// Desconectar y borrar credenciales de un local
app.post('/api/disconnect', async (req, res) => {
  const { localId } = req.body;
  if (!localId) {
    return res.status(400).json({ error: 'Falta el parámetro localId' });
  }

  const session = sessions.get(localId);
  if (session && session.sock) {
    try {
      await session.sock.logout();
    } catch (e) {
      // Ignorar si ya estaba desconectado
    }
  }

  sessions.delete(localId);
  
  const localAuthPath = path.join(authFolder, localId);
  if (fs.existsSync(localAuthPath)) {
    try {
      fs.rmSync(localAuthPath, { recursive: true, force: true });
    } catch (e) {
      console.error('Error borrando carpeta de credenciales:', e);
    }
  }

  // Desactivar en la base de datos de Supabase
  try {
    await supabase.from('locales').update({
      whatsapp_assistant_enabled: false,
      whatsapp_phone_number: null,
      whatsapp_phone_id: null
    }).eq('id', localId);
  } catch (err) {
    console.error('Error actualizando estado en Supabase al desconectar:', err);
  }

  res.json({ status: 'disconnected' });
});

// Endpoint seguro para enviar notificaciones automáticas de seguimiento solo a usuarios con Opt-in y si el Toggle esta activado
app.post('/api/send-followup-optin', async (req, res) => {
  const { ciudad, tipo = 'repartidores_disponibles' } = req.body;

  try {
    // 1. Obtener la configuración del flujo desde Supabase
    let flowRow = null;
    try {
      const { data } = await supabase.from('whatsapp_bot_flows').select('flow_data').eq('id', 'main_flow').maybeSingle();
      flowRow = data;
    } catch (e) {}

    if (!flowRow) {
      const { data: config } = await supabase.from('configuracion').select('whatsapp_bot_flows').eq('id', 'global').maybeSingle();
      if (config?.whatsapp_bot_flows) flowRow = { flow_data: config.whatsapp_bot_flows };
    }

    const flows = flowRow?.flow_data || {};

    // VERIFICAR TOGGLE: Si los seguimientos están desactivados desde /admin, NO enviar
    if (flows.seguimientos?.enabled === false) {
      console.log("[Seguimiento] Envíos omitidos: Seguimientos automáticos deshabilitados en /admin");
      return res.json({ success: false, reason: 'Seguimientos automáticos desactivados en /admin' });
    }

    const messageText = tipo === 'sin_repartidor' 
      ? (flows.seguimientos?.sin_repartidor || "😔 No encontramos un repartidor disponible en este momento.\nPodés repetirlo en un solo clic: https://wepi.com.ar/mis-pedidos\n\nApenas haya repartidores disponibles te avisaremos.")
      : (flows.seguimientos?.repartidores_disponibles || "🛵 Ya tenemos repartidores disponibles\nPodés repetir tu pedido en un solo clic: https://wepi.com.ar/mis-pedidos");

    // VERIFICAR AUTORIZACIÓN OPT-IN: Solo usuarios en whatsapp_optins con status PENDING
    let query = supabase.from('whatsapp_optins').select('*').eq('status', 'PENDING');
    if (ciudad) {
      query = query.eq('ciudad', ciudad);
    }

    const { data: optins, error } = await query;

    if (error || !optins || optins.length === 0) {
      return res.json({ success: true, count: 0, message: 'No hay usuarios autorizados (Opt-in) pendientes.' });
    }

    const sessionObj = sessions.get('global') || sessions.get('3756543670') || sessions.get('main_bot');
    
    let sentCount = 0;
    for (const opt of optins) {
      const cleanPhone = opt.phone_number.replace(/\D/g, '');
      const toJid = `${cleanPhone}@s.whatsapp.net`;

      if (sessionObj && sessionObj.sock) {
        await sendSmartMessage('3756543670', sessionObj.sock, toJid, { text: messageText });
      }

      // Marcar Opt-in como NOTIFIED para no duplicar avisos
      await supabase
        .from('whatsapp_optins')
        .update({ status: 'NOTIFIED', notified_at: new Date().toISOString() })
        .eq('id', opt.id);

      sentCount++;
    }

    console.log(`[Seguimiento Opt-in] Enviados ${sentCount} avisos para ciudad ${ciudad || 'Todas'}`);
    res.json({ success: true, count: sentCount, message: `Enviados ${sentCount} avisos a usuarios autorizados.` });
  } catch (err) {
    console.error("Error en enviador de notificaciones de seguimiento:", err);
    res.status(500).json({ error: err.message });
  }
});

// Inicializar automáticamente al arrancar el servidor todas las sesiones que ya estaban previamente vinculadas
async function autostartSessions() {
  console.log('[Autostart] Escaneando sesiones guardadas anteriormente...');
  const files = fs.readdirSync(authFolder);
  
  for (const file of files) {
    const localAuthPath = path.join(authFolder, file);
    if (fs.statSync(localAuthPath).isDirectory()) {
      console.log(`[Autostart] Restaurando conexión guardada para local ${file}...`);
      try {
        await initSession(file);
      } catch (err) {
        console.error(`[Autostart] Error al restaurar local ${file}:`, err);
      }
    }
  }
}

app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🔌 Servidor de WhatsApp Wepi corriendo en puerto ${PORT}`);
  console.log(`====================================================`);
  await autostartSessions();
});
