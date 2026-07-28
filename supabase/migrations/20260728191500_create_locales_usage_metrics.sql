-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: CREAR TABLA DE MÉTRICAS DE USO DIARIO DE LOCALES
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.locales_uso_metricas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  local_id TEXT REFERENCES public.locales(id) ON DELETE CASCADE,
  fecha DATE DEFAULT CURRENT_DATE NOT NULL,
  visitas_totales INT DEFAULT 0,
  visitas_whatsapp INT DEFAULT 0,
  visitas_enlace_propio INT DEFAULT 0,
  carritos_creados INT DEFAULT 0,
  pedidos_creados INT DEFAULT 0,
  creado_a TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (local_id, fecha)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.locales_uso_metricas ENABLE ROW LEVEL SECURITY;

-- Crear políticas para permitir lectura y escritura general
-- (El cliente público debe poder registrar visitas/clicks y el admin verlas)
CREATE POLICY "Permitir lectura general de métricas" ON public.locales_uso_metricas
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserción general de métricas" ON public.locales_uso_metricas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización general de métricas" ON public.locales_uso_metricas
  FOR UPDATE USING (true) WITH CHECK (true);

-- Función RPC para incrementar atómicamente métricas diarias
CREATE OR REPLACE FUNCTION public.increment_local_metric(local_uuid TEXT, metric_name TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.locales_uso_metricas (local_id, fecha)
  VALUES (local_uuid, CURRENT_DATE)
  ON CONFLICT (local_id, fecha)
  DO UPDATE SET
    visitas_totales = CASE WHEN metric_name = 'visitas_totales' THEN locales_uso_metricas.visitas_totales + 1 ELSE locales_uso_metricas.visitas_totales END,
    visitas_whatsapp = CASE WHEN metric_name = 'visitas_whatsapp' THEN locales_uso_metricas.visitas_whatsapp + 1 ELSE locales_uso_metricas.visitas_whatsapp END,
    visitas_enlace_propio = CASE WHEN metric_name = 'visitas_enlace_propio' THEN locales_uso_metricas.visitas_enlace_propio + 1 ELSE locales_uso_metricas.visitas_enlace_propio END,
    carritos_creados = CASE WHEN metric_name = 'carritos_creados' THEN locales_uso_metricas.carritos_creados + 1 ELSE locales_uso_metricas.carritos_creados END,
    pedidos_creados = CASE WHEN metric_name = 'pedidos_creados' THEN locales_uso_metricas.pedidos_creados + 1 ELSE locales_uso_metricas.pedidos_creados END;
END;
$$ LANGUAGE 'plpgsql' SECURITY DEFINER;
