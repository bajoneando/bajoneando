-- Migración: Meta Cloud API para WhatsApp (Embedded Signup & Coexistencia)

ALTER TABLE locales 
ADD COLUMN IF NOT EXISTS whatsapp_waba_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

-- Comentarios explicativos en la tabla
COMMENT ON COLUMN locales.whatsapp_waba_id IS 'ID de la Cuenta de WhatsApp Business (WABA) en Meta';
COMMENT ON COLUMN locales.whatsapp_access_token IS 'Token de acceso de Meta Cloud API del comercio';
COMMENT ON COLUMN locales.whatsapp_phone_id IS 'ID del número de teléfono en Meta Cloud API';
