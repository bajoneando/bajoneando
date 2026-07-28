-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: AGREGAR COLUMNAS PARA WEPI ASSISTANT (WHATSAPP BOT)
-- ═══════════════════════════════════════════════════

ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS whatsapp_assistant_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS whatsapp_phone_number TEXT;
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS whatsapp_phone_id TEXT;
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

-- Comentarios descriptivos
COMMENT ON COLUMN public.locales.whatsapp_assistant_enabled IS 'Indica si el asistente de WhatsApp (bot) está activo para el comercio';
COMMENT ON COLUMN public.locales.whatsapp_phone_number IS 'Número completo de WhatsApp configurado para el comercio (con código de país)';
COMMENT ON COLUMN public.locales.whatsapp_phone_id IS 'ID de teléfono de WhatsApp proporcionado por Meta Cloud API';
COMMENT ON COLUMN public.locales.whatsapp_access_token IS 'Token de acceso de Meta para realizar llamadas a la API de WhatsApp';
