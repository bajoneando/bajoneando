-- 1. Tabla para almacenar la matriz de automatizaciones por eventos del CRM
CREATE TABLE IF NOT EXISTS public.crm_automation_matrix (
    id TEXT PRIMARY KEY DEFAULT 'main_matrix',
    matrix_data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.crm_automation_matrix ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura publica crm_automation_matrix" ON public.crm_automation_matrix;
DROP POLICY IF EXISTS "Permitir modificacion admin crm_automation_matrix" ON public.crm_automation_matrix;
CREATE POLICY "Permitir lectura publica crm_automation_matrix" ON public.crm_automation_matrix FOR SELECT USING (true);
CREATE POLICY "Permitir modificacion admin crm_automation_matrix" ON public.crm_automation_matrix FOR ALL USING (true);

-- 2. Función de Motor de Envíos Multicanal en Cascada (Priority Fallback Engine)
-- Intenta 1° canal -> Si no cumple o no tiene autorización/config -> Intenta 2° -> Intenta 3°
CREATE OR REPLACE FUNCTION public.trigger_crm_event_notification(
    p_user_id UUID,
    p_event_id TEXT,
    p_params JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    r_user RECORD;
    v_matrix JSONB;
    v_event JSONB;
    v_channels JSONB;
    v_configs JSONB;
    v_ch TEXT;
    v_cfg JSONB;
    v_success BOOLEAN := FALSE;
    v_dispatched_channel TEXT := NULL;
    v_optin_exists BOOLEAN := FALSE;
    v_has_push_token BOOLEAN := FALSE;
    v_has_email BOOLEAN := FALSE;
    v_idx INT;
BEGIN
    -- Obtenemos información del usuario
    SELECT u.id, u.nombre, u.email, u.telefono, u.onesignal_player_id
    INTO r_user
    FROM public.usuarios u
    WHERE u.id = p_user_id;

    IF r_user.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Usuario no encontrado');
    END IF;

    -- Verificar presencia de credenciales por canal
    v_has_email := (r_user.email IS NOT NULL AND r_user.email LIKE '%@%');
    v_has_push_token := (r_user.onesignal_player_id IS NOT NULL AND r_user.onesignal_player_id <> '');
    
    -- Verificar si tiene consentimiento Opt-in de WhatsApp
    IF r_user.telefono IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.whatsapp_optins 
            WHERE phone_number = r_user.telefono OR user_id = r_user.id::text
        ) INTO v_optin_exists;
    END IF;

    -- Cargar matriz de automatización activa
    SELECT matrix_data INTO v_matrix
    FROM public.crm_automation_matrix
    WHERE id = 'main_matrix';

    IF v_matrix IS NULL THEN
        SELECT crm_automation_matrix INTO v_matrix
        FROM public.configuracion
        WHERE id = 'global';
    END IF;

    IF v_matrix IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Matriz de automatización no configurada');
    END IF;

    -- Buscar el evento específico en la matriz
    SELECT elem INTO v_event
    FROM jsonb_array_elements(v_matrix) elem
    WHERE elem->>'id' = p_event_id;

    IF v_event IS NULL OR NOT (v_event->>'enabled')::boolean THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Evento inactivo o no encontrado');
    END IF;

    v_channels := v_event->'canales';
    v_configs := v_event->'configs';

    -- Iterar en orden prioritario (0: 1° Canal, 1: 2° Canal, 2: 3° Canal)
    FOR v_idx IN 0..jsonb_array_length(v_channels) - 1 LOOP
        v_ch := v_channels->>v_idx;
        IF v_ch IS NULL OR v_ch = 'none' THEN
            CONTINUE;
        END IF;

        v_cfg := v_configs->v_ch;
        IF v_cfg IS NULL OR NOT (v_cfg->>'enabled')::boolean THEN
            CONTINUE; -- Canal deshabilitado para este evento
        END IF;

        -- EVALUAR CANAL 1: WHATSAPP
        IF v_ch = 'whatsapp' THEN
            IF r_user.telefono IS NOT NULL AND v_optin_exists AND v_cfg->>'template_name' IS NOT NULL THEN
                -- Registrar despacho de WhatsApp
                v_success := TRUE;
                v_dispatched_channel := 'whatsapp';
                EXIT; -- Salir del bucle pues ya se envió por el canal de mayor prioridad elegible
            END IF;
        
        -- EVALUAR CANAL 2: PUSH (OneSignal)
        ELSIF v_ch = 'push' THEN
            IF v_has_push_token AND v_cfg->>'title' IS NOT NULL THEN
                -- Registrar despacho de Push Notification
                v_success := TRUE;
                v_dispatched_channel := 'push';
                EXIT;
            END IF;

        -- EVALUAR CANAL 3: EMAIL
        ELSIF v_ch = 'email' THEN
            IF v_has_email AND v_cfg->>'subject' IS NOT NULL THEN
                -- Registrar despacho de Email
                v_success := TRUE;
                v_dispatched_channel := 'email';
                EXIT;
            END IF;
        END IF;

    END LOOP;

    IF v_success THEN
        -- Registrar en historial de eventos del CRM
        INSERT INTO public.crm_history (usuario_id, tipo, canal, detalle, fecha)
        VALUES (
            p_user_id,
            'mensaje_automatizado',
            v_dispatched_channel,
            'Evento: ' || p_event_id || ' vía ' || UPPER(v_dispatched_channel),
            timezone('utc'::text, now())
        );

        RETURN jsonb_build_object(
            'success', true,
            'event_id', p_event_id,
            'dispatched_channel', v_dispatched_channel,
            'user_id', p_user_id
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'Ningún canal de la cascada cumplió con las condiciones o permisos del usuario'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
