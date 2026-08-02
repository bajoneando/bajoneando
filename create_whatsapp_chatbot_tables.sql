-- 0. Columna de respaldo en tabla configuracion
ALTER TABLE public.configuracion ADD COLUMN IF NOT EXISTS whatsapp_bot_flows JSONB;

-- 1. Tabla para almacenar la configuración de flujos del bot (3756543670)
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_flows (
    id TEXT PRIMARY KEY DEFAULT 'main_flow',
    phone_number TEXT DEFAULT '3756543670',
    support_phone TEXT DEFAULT '3756543610',
    flow_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla para almacenar consentimientos de Opt-in de usuarios (por ejemplo cuando no hay repartidores)
CREATE TABLE IF NOT EXISTS public.whatsapp_optins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    user_id TEXT,
    ciudad TEXT DEFAULT 'Santo Tomé',
    pedido_id TEXT,
    tipo TEXT DEFAULT 'driver_available',
    status TEXT DEFAULT 'PENDING', -- PENDING, NOTIFIED, EXPIRED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    notified_at TIMESTAMP WITH TIME ZONE
);

-- 3. Tabla para plantillas de WhatsApp API (Meta HSM Templates)
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT 'UTILITY', -- UTILITY, MARKETING, AUTHENTICATION
    language TEXT DEFAULT 'es_AR',
    body_text TEXT NOT NULL,
    header_text TEXT,
    footer_text TEXT,
    status TEXT DEFAULT 'APPROVED', -- APPROVED, PENDING, REJECTED
    variables TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS en las tablas
ALTER TABLE public.whatsapp_bot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_optins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura públicas o autenticadas
CREATE POLICY "Permitir lectura publica whatsapp_bot_flows" ON public.whatsapp_bot_flows FOR SELECT USING (true);
CREATE POLICY "Permitir modificacion admin whatsapp_bot_flows" ON public.whatsapp_bot_flows FOR ALL USING (true);

CREATE POLICY "Permitir insercion publica whatsapp_optins" ON public.whatsapp_optins FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir lectura publica whatsapp_optins" ON public.whatsapp_optins FOR SELECT USING (true);
CREATE POLICY "Permitir modificacion whatsapp_optins" ON public.whatsapp_optins FOR UPDATE USING (true);

CREATE POLICY "Permitir lectura publica whatsapp_templates" ON public.whatsapp_templates FOR SELECT USING (true);
CREATE POLICY "Permitir modificacion whatsapp_templates" ON public.whatsapp_templates FOR ALL USING (true);

-- Datos iniciales por defecto para whatsapp_bot_flows
INSERT INTO public.whatsapp_bot_flows (id, phone_number, support_phone, flow_data, is_active)
VALUES (
    'main_flow',
    '3756543670',
    '3756543610',
    '{
      "inicio": {
        "mensaje": "👋 ¡Hola! Soy Wepi Bot.\n\n¿En qué puedo ayudarte?",
        "keywords": "hola, buenas, inicio, menu, empiece, empezar, hi, hello, saludos",
        "opciones": [
          { "key": "1", "label": "1️⃣ 🍔 Hacer un pedido", "action": "hacer_pedido", "keywords": "1, pedir, hacer un pedido, carta, menu, comprar, orden" },
          { "key": "2", "label": "2️⃣ 📦 Estado de mi pedido", "action": "estado_pedido", "keywords": "2, estado, mi pedido, donde esta, seguimiento, rastrear" },
          { "key": "3", "label": "3️⃣ ❓ Ayuda", "action": "ayuda", "keywords": "3, ayuda, consulta, duda, faq" },
          { "key": "4", "label": "4️⃣ 👨 Hablar con soporte", "action": "soporte", "keywords": "4, hablar con soporte, soporte, humano, agente, reclamo" }
        ]
      },
      "hacer_pedido": {
        "mensaje": "🍔 Elegí tu ciudad.\n(O usar ubicación)",
        "keywords": "1, pedir, hacer un pedido, carta, menu, comprar, orden",
        "ciudades": [
          { "nombre": "Santo Tomé", "slug": "santo-tome" },
          { "nombre": "Oberá", "slug": "obera" },
          { "nombre": "Apóstoles", "slug": "apostoles" },
          { "nombre": "Alem", "slug": "alem" },
          { "nombre": "Goya", "slug": "goya" }
        ],
        "footer": "↓\nAbrí Wepi y hacé tu pedido 👇\nwepi.com.ar/pedir/"
      },
      "estado_pedido": {
        "mensaje": "📦 Podés consultar el estado de tu pedido en tiempo real ingresando aquí 👇\nhttps://wepi.com.ar/mis-pedidos",
        "keywords": "2, estado, mi pedido, donde esta, seguimiento, rastrear"
      },
      "ayuda": {
        "mensaje": "¿Sobre qué necesitás ayuda?",
        "keywords": "3, ayuda, consulta, duda, faq",
        "opciones": [
          {
            "key": "1",
            "titulo": "💳 Cómo pagar",
            "respuesta": "💳 *Métodos de pago en Wepi*:\n\nPodés pagar en efectivo al recibir, con transferencia o mediante tarjeta/Mercado Pago desde la web. También podés utilizar tu saldo de Wepi Wallet.",
            "keywords": "1, 3.1, pagar, pago, efectivo, mercadopago, mp, tarjeta, transferencia"
          },
          {
            "key": "2",
            "titulo": "📍 Cómo seguir mi pedido",
            "respuesta": "📍 *Seguimiento de pedidos*:\n\nIngresá a https://wepi.com.ar/mis-pedidos para ver el estado de tu pedido en vivo y la ubicación del repartidor.",
            "keywords": "2, 3.2, seguir, seguimiento, rastreo, mapa, repartidor"
          },
          {
            "key": "3",
            "titulo": "🔑 Recuperar contraseña",
            "respuesta": "🔑 *Recuperar contraseña*:\n\nAl iniciar sesión en Wepi, elegí la opción ''¿Olvidaste tu contraseña?'' e ingresá tu email para recibir el enlace de restablecimiento.",
            "keywords": "3, 3.3, clave, contraseña, password, olvide, recuperar"
          },
          {
            "key": "4",
            "titulo": "📞 Hablar con soporte",
            "respuesta": "📞 *Contacto con Soporte Wepi*:\n\nUn representante te atenderá de inmediato aquí: https://wa.me/5493756543610",
            "keywords": "4, 3.4, hablar con soporte, agente, persona, representante, reclamo, problema"
          }
        ]
      },
      "soporte": {
        "mensaje": "👨 Te estamos derivando con el equipo de Soporte de Wepi.\n\nHacé clic en el siguiente enlace para chatear con un agente:\nhttps://wa.me/5493756543610",
        "keywords": "4, soporte, humano, agente, persona, reclamo, ayuda humana"
      },
      "seguimientos": {
        "sin_repartidor": "😔 No encontramos un repartidor disponible en este momento.\nPodés repetirlo en un solo clic: https://wepi.com.ar/mis-pedidos\n\nApenas haya repartidores disponibles te avisaremos.",
        "repartidores_disponibles": "🛵 Ya tenemos repartidores disponibles\nPodés repetir tu pedido en un solo clic: https://wepi.com.ar/mis-pedidos"
      }
    }'::jsonb,
    true
) ON CONFLICT (id) DO NOTHING;

-- Seed inicial de plantillas WhatsApp API
INSERT INTO public.whatsapp_templates (name, category, language, body_text, status, variables)
VALUES 
(
    'pedido_sin_repartidor',
    'UTILITY',
    'es_AR',
    '😔 No encontramos un repartidor disponible en este momento para tu pedido {{1}}. Podés repetirlo en un solo clic: {{2}}. Apenas haya repartidores disponibles te avisaremos.',
    'APPROVED',
    ARRAY['pedido_id', 'url_mis_pedidos']
),
(
    'repartidores_disponibles_alerta',
    'UTILITY',
    'es_AR',
    '🛵 ¡Buenas noticias! Ya tenemos repartidores disponibles en {{1}}. Podés repetir tu pedido en un solo clic: {{2}}',
    'APPROVED',
    ARRAY['ciudad', 'url_mis_pedidos']
)
ON CONFLICT (name) DO NOTHING;
