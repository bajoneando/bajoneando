const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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

async function initSession(localId) {
  if (sessions.has(localId)) {
    const session = sessions.get(localId);
    if (session.status !== 'disconnected') {
      return session;
    }
  }

  // Guardar un placeholder en memoria de forma SÍNCRONA antes de cualquier await para evitar llamadas concurrentes
  const sessionObj = {
    sock: null,
    status: 'loading',
    qr: null,
    phoneNumber: null
  };
  sessions.set(localId, sessionObj);

  console.log(`[Session Manager] Inicializando sesión para localId: ${localId}`);
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
  
  // Obtener la versión más reciente de WhatsApp Web para evitar el error de desconexión 405 (Method Not Allowed)
  let version = [2, 3000, 1015951307]; // Fallback moderno
  try {
    const { fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
    console.log(`[Session Manager] Usando versión de WhatsApp Web: ${version.join('.')}`);
  } catch (err) {
    console.warn('[Session Manager] No se pudo obtener la versión en tiempo real, usando fallback de versión.');
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }), // Evita spam de logs en la consola
    printQRInTerminal: false
  });

  sessionObj.sock = sock;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Convertir el QR de texto en una imagen base64 para el frontend
      try {
        const qrImage = await QRCode.toDataURL(qr);
        sessionObj.status = 'qr_ready';
        sessionObj.qr = qrImage;
        console.log(`[Session Manager] QR listo para el local ${localId}`);
      } catch (err) {
        console.error('Error al generar código QR:', err);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`[Session Manager] Conexión cerrada para local ${localId}. Reconectar: ${shouldReconnect}`);
      
      sessionObj.status = 'disconnected';
      sessionObj.qr = null;

      if (shouldReconnect) {
        // Intentar reconectar automáticamente si no se cerró sesión intencionalmente
        setTimeout(() => initSession(localId), 5000);
      } else {
        // Si el usuario cerró sesión en el celular, borramos la carpeta de credenciales
        console.log(`[Session Manager] Sesión cerrada permanentemente por el usuario. Limpiando datos.`);
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

      // Guardar el estado activo en la base de datos de Supabase
      try {
        await supabase.from('locales').update({
          whatsapp_assistant_enabled: true,
          whatsapp_phone_number: sessionObj.phoneNumber,
          whatsapp_phone_id: 'baileys_session' // Indicador de que usa QR
        }).eq('id', localId);
        console.log(`[Supabase] Estado del bot guardado en base de datos para local ${localId}`);
      } catch (err) {
        console.error('Error actualizando Supabase con el número vinculado:', err);
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
        await handleIncomingMessage(localId, sock, from, msg);
      } catch (err) {
        console.error(`Error procesando mensaje entrante de ${from}:`, err);
      }
    }
  });

  return sessionObj;
}

// Enviar mensaje simulando escritura humana y con retraso aleatorio (Anti-Ban)
async function sendSmartMessage(sock, to, content) {
  try {
    // 1. Mostrar estado "Escribiendo..."
    await sock.sendPresenceUpdate('composing', to);
    
    // 2. Calcular retraso aleatorio entre 1.5 y 3.5 segundos
    const delay = Math.floor(Math.random() * 2000) + 1500;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 3. Detener estado "Escribiendo..." y enviar el mensaje
    await sock.sendPresenceUpdate('paused', to);
    await sock.sendMessage(to, content);
  } catch (err) {
    console.error(`Error al enviar mensaje inteligente a ${to}:`, err);
  }
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

  console.log(`[Bot ${localId}] Mensaje recibido de ${from}: "${text}"`);

  // 1. Obtener la información del local desde Supabase
  const { data: local, error: localErr } = await supabase
    .from('locales')
    .select('id, nombre, ciudad, slug')
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
      await sendSmartMessage(sock, from, {
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

    await sendSmartMessage(sock, from, { text: menuText });

  } else if (text === '1' || text.includes('carta') || text.includes('menu') || text.includes('catálogo')) {
    // Enviar link del menú completo
    const responseText = `¡Perfecto! Aquí tenés el menú completo de *${local.nombre}* para elegir lo que quieras 👇\n\n🔗 ${baseUrl}?utm_source=wa_bot\n\n_Sumá tus productos al carrito y finalizá el pedido desde la web de forma simple._`;
    await sendSmartMessage(sock, from, { text: responseText });

  } else {
    // Mensaje de saludo de bienvenida inicial (Cualquier otro texto)
    const welcomeText = `¡Hola! 👋 Soy *Wepi Assistant*, el asistente virtual de *${local.nombre}*.\n\nTe ayudo a hacer tu pedido más rápido. ¿Qué querés hacer hoy? \n\n1️⃣ *Ver el Menú Completo* (Abrir catálogo digital)\n2️⃣ *Buscar por Categorías* (Pizzas, Hamburguesas, etc.)\n\n_Respondé con el número *1* o *2* para continuar._`;
    await sendSmartMessage(sock, from, { text: welcomeText });
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
    phoneNumber: session.phoneNumber
  });
});

// Iniciar proceso de vinculación (Generar QR o reconectar)
app.post('/api/connect', async (req, res) => {
  const { localId } = req.body;
  if (!localId) {
    return res.status(400).json({ error: 'Falta el parámetro localId' });
  }

  try {
    const session = await initSession(localId);
    res.json({
      status: session.status,
      qr: session.qr,
      phoneNumber: session.phoneNumber
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
