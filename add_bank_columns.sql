-- Ejecuta este comando en el editor SQL de Supabase para añadir las columnas bancarias faltantes
ALTER TABLE repartidores 
ADD COLUMN IF NOT EXISTS alias_cbu text,
ADD COLUMN IF NOT EXISTS nombre_cuenta text;
