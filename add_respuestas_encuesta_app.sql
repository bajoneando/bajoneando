-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: CREACIÓN DE TABLA PARA ENCUESTA DE INTERÉS EN APP MÓVIL
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.respuestas_encuesta_app (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    pedido_id TEXT,
    quiere_app BOOLEAN, -- NULL si se omite
    motivo TEXT,
    dispositivo TEXT,   -- 'Apple', 'Android', 'Ambos', 'Ninguno' (NULL si se omite)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para optimizar búsquedas por user_id
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta_app_user_id ON public.respuestas_encuesta_app(user_id);

-- Deshabilitar Row Level Security (RLS) para simplificar consultas desde el cliente
ALTER TABLE public.respuestas_encuesta_app DISABLE ROW LEVEL SECURITY;
