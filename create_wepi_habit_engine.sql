-- 1. Tabla para almacenar la configuración global y los momentos del Motor de Hábitos WEPI
CREATE TABLE IF NOT EXISTS public.wepi_habit_config (
    id TEXT PRIMARY KEY DEFAULT 'main_habits',
    config_data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.wepi_habit_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura publica wepi_habit_config" ON public.wepi_habit_config;
DROP POLICY IF EXISTS "Permitir modificacion admin wepi_habit_config" ON public.wepi_habit_config;
CREATE POLICY "Permitir lectura publica wepi_habit_config" ON public.wepi_habit_config FOR SELECT USING (true);
CREATE POLICY "Permitir modificacion admin wepi_habit_config" ON public.wepi_habit_config FOR ALL USING (true);

-- 2. Función del Motor de Hábitos: Evaluador de Elegibilidad y Cascada de Canales
-- Aplica los Caps de Frecuencia (3/sem total, 1/sem WA, Prioridad Push App, Invitación 'instala_app')
CREATE OR REPLACE FUNCTION public.process_wepi_habit_job(
    p_moment_key TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_config JSONB;
    v_global JSONB;
    v_moments JSONB;
    v_moment JSONB;
    v_max_weekly INT := 3;
    v_max_weekly_wa INT := 1;
    v_prioritize_push BOOLEAN := TRUE;
    v_wa_invite_app_template TEXT := 'instala_app';
    v_wa_invite_app_enabled BOOLEAN := TRUE;
    v_predictive_enabled BOOLEAN := TRUE;
    
    r_user RECORD;
    v_has_push BOOLEAN;
    v_has_email BOOLEAN;
    v_optin_wa BOOLEAN;
    v_weekly_total_count INT;
    v_weekly_wa_count INT;
    v_sent_today BOOLEAN;
    v_dispatched_channel TEXT;
    v_dispatched_count INT := 0;
    v_ch TEXT;
    v_cfg JSONB;
    v_idx INT;
BEGIN
    -- Cargar configuración del Motor de Hábitos
    SELECT config_data INTO v_config
    FROM public.wepi_habit_config
    WHERE id = 'main_habits';

    IF v_config IS NULL THEN
        SELECT wepi_habit_config INTO v_config
        FROM public.configuracion
        WHERE id = 'global';
    END IF;

    IF v_config IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Configuración de hábitos no encontrada');
    END IF;

    v_global := v_config->'global_settings';
    v_moments := v_config->'moments';

    IF v_global IS NOT NULL THEN
        v_max_weekly := COALESCE((v_global->>'max_weekly_per_user')::int, 3);
        v_max_weekly_wa := COALESCE((v_global->>'max_weekly_whatsapp')::int, 1);
        v_prioritize_push := COALESCE((v_global->>'prioritize_push_app')::boolean, true);
        v_wa_invite_app_template := COALESCE(v_global->>'wa_invite_app_template', 'instala_app');
        v_wa_invite_app_enabled := COALESCE((v_global->>'wa_invite_app_enabled')::boolean, true);
        v_predictive_enabled := COALESCE((v_global->>'predictive_habits_enabled')::boolean, true);
    END IF;

    -- Obtener el momento de consumo específico (ej: 'almuerzo')
    SELECT elem INTO v_moment
    FROM jsonb_array_elements(v_moments) elem
    WHERE elem->>'id' = p_moment_key;

    IF v_moment IS NULL OR NOT (v_moment->>'enabled')::boolean THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Momento de hábito inactivo o no configurado');
    END IF;

    -- ITERAR SOBRE USUARIOS ELEGIBLES DE LA PLATAFORMA
    FOR r_user IN 
        SELECT u.id, u.nombre, u.email, u.telefono, u.onesignal_player_id
        FROM public.usuarios u
        WHERE u.estado_crm IS DISTINCT FROM 'DORMIDO' -- No dormidos críticos
    LOOP
        -- 1. FILTRO: No tener pedidos en curso (en preparación o reparto)
        IF EXISTS (
            SELECT 1 FROM public.pedidos p 
            WHERE p.user_id = r_user.id 
              AND p.estado IN ('Pendiente', 'Aceptado', 'En Preparacion', 'En Camino')
        ) THEN
            CONTINUE;
        END IF;

        -- 2. FILTRO: No haber comprado hoy
        IF EXISTS (
            SELECT 1 FROM public.pedidos p 
            WHERE p.user_id = r_user.id 
              AND DATE(p.created_at) = CURRENT_DATE
        ) THEN
            CONTINUE;
        END IF;

        -- 3. FILTRO: No haber recibido otro mensaje comercial hoy (Max 1 mensaje/día)
        SELECT EXISTS (
            SELECT 1 FROM public.crm_history h
            WHERE h.usuario_id = r_user.id 
              AND DATE(h.fecha) = CURRENT_DATE
        ) INTO v_sent_today;

        IF v_sent_today THEN
            CONTINUE;
        END IF;

        -- 4. FILTRO: Cap de Frecuencia Semanal Total (Máximo 3 veces por semana)
        SELECT COUNT(*) INTO v_weekly_total_count
        FROM public.crm_history h
        WHERE h.usuario_id = r_user.id 
          AND h.tipo LIKE '%habit%'
          AND h.fecha >= CURRENT_DATE - INTERVAL '7 days';

        IF v_weekly_total_count >= v_max_weekly THEN
            CONTINUE;
        END IF;

        -- Evaluar credenciales por canal
        v_has_push := (r_user.onesignal_player_id IS NOT NULL AND r_user.onesignal_player_id <> '');
        v_has_email := (r_user.email IS NOT NULL AND r_user.email LIKE '%@%');
        
        v_optin_wa := FALSE;
        IF r_user.telefono IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.whatsapp_optins 
                WHERE phone_number = r_user.telefono OR user_id = r_user.id::text
            ) INTO v_optin_wa;
        END IF;

        v_dispatched_channel := NULL;

        -- CASCADA DE CANALES CON PRIORIDAD
        -- 🥇 SI TIENE PUSH APP -> PRIORIZAR PUSH SIEMPRE
        IF v_has_push AND v_prioritize_push THEN
            v_dispatched_channel := 'push';

        -- 🥈 SI NO TIENE PUSH APP -> EVALUAR WHATSAPP (CON CAP DE 1 ENVIO/SEMANA MAX + INVITACION INSTALA APP)
        ELSIF r_user.telefono IS NOT NULL AND v_optin_wa THEN
            -- Contar envíos de WhatsApp en los últimos 7 días
            SELECT COUNT(*) INTO v_weekly_wa_count
            FROM public.crm_history h
            WHERE h.usuario_id = r_user.id 
              AND h.canal = 'whatsapp'
              AND h.tipo LIKE '%habit%'
              AND h.fecha >= CURRENT_DATE - INTERVAL '7 days';

            IF v_weekly_wa_count < v_max_weekly_wa THEN
                v_dispatched_channel := 'whatsapp';
            END IF;

        -- 🥉 SI NO CUMPLE PUSH NI WA -> EMAIL
        ELSIF v_has_email THEN
            v_dispatched_channel := 'email';
        END IF;

        -- DESPACHAR SI SE ENCONTRÓ CANAL ELEGIBLE
        IF v_dispatched_channel IS NOT NULL THEN
            INSERT INTO public.crm_history (usuario_id, tipo, canal, detalle, fecha)
            VALUES (
                r_user.id,
                'habit_moment_' || p_moment_key,
                v_dispatched_channel,
                'Motor de Hábitos: Momento ' || UPPER(p_moment_key) || ' vía ' || UPPER(v_dispatched_channel),
                timezone('utc'::text, now())
            );
            v_dispatched_count := v_dispatched_count + 1;
        END IF;

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'moment_key', p_moment_key,
        'dispatched_count', v_dispatched_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Programación de Jobs Automáticos (`pg_cron`) para los 6 Momentos del Día
SELECT cron.schedule('wepi_habit_desayuno', '30 8 * * *',  $$ SELECT public.process_wepi_habit_job('desayuno'); $$);
SELECT cron.schedule('wepi_habit_almuerzo', '0 12 * * *',   $$ SELECT public.process_wepi_habit_job('almuerzo'); $$);
SELECT cron.schedule('wepi_habit_postre',   '30 15 * * *',  $$ SELECT public.process_wepi_habit_job('postre'); $$);
SELECT cron.schedule('wepi_habit_merienda', '0 17 * * *',   $$ SELECT public.process_wepi_habit_job('merienda'); $$);
SELECT cron.schedule('wepi_habit_cena',     '30 20 * * *',  $$ SELECT public.process_wepi_habit_job('cena'); $$);
SELECT cron.schedule('wepi_habit_antojo',   '0 23 * * *',   $$ SELECT public.process_wepi_habit_job('antojo'); $$);
