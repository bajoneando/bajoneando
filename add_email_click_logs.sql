-- ═══════════════════════════════════════════════════
-- REGISTRO DE CLICS Y CONVERSIONES DE EMAIL MARKETING
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.email_click_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign TEXT NOT NULL DEFAULT 'Campaña General',
    ciudad TEXT DEFAULT NULL,
    path TEXT DEFAULT '/pedir',
    user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_click_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir insercion publica de clics email"
ON public.email_click_logs FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Permitir lectura publica de clics email"
ON public.email_click_logs FOR SELECT
TO public
USING (true);
