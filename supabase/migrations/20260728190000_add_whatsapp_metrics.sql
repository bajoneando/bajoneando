-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: AGREGAR MÉTRICAS DE SEGUIMIENTO PARA WEPI ASSISTANT
-- ═══════════════════════════════════════════════════

-- 1. Agregar columnas para el conteo de uso en public.locales
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS whatsapp_messages_sent INT DEFAULT 0;
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS whatsapp_link_clicks INT DEFAULT 0;

-- 2. Función RPC para incrementar atómicamente el contador de mensajes enviados
CREATE OR REPLACE FUNCTION public.increment_whatsapp_messages(local_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.locales
  SET whatsapp_messages_sent = COALESCE(whatsapp_messages_sent, 0) + 1
  WHERE id = local_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función RPC para incrementar atómicamente el contador de visitas desde el bot
CREATE OR REPLACE FUNCTION public.increment_whatsapp_clicks(local_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.locales
  SET whatsapp_link_clicks = COALESCE(whatsapp_link_clicks, 0) + 1
  WHERE id = local_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios informativos
COMMENT ON COLUMN public.locales.whatsapp_messages_sent IS 'Cantidad de mensajes enviados de forma automatizada por el asistente virtual';
COMMENT ON COLUMN public.locales.whatsapp_link_clicks IS 'Cantidad de clicks y visitas que llegaron al menú digital desde el enlace del bot';
