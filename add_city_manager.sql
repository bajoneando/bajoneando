-- 1. Anadir columna funcional a ciudades_config
ALTER TABLE public.ciudades_config ADD COLUMN IF NOT EXISTS funcional BOOLEAN DEFAULT true;

-- 2. Asegurarnos que Santo Tome y Obera existan y sean funcionales
INSERT INTO public.ciudades_config (ciudad, tipo_logistica, funcional)
VALUES 
    ('Santo Tomé', 'individual', true),
    ('Oberá', 'individual', true)
ON CONFLICT (ciudad) DO UPDATE 
SET funcional = true;