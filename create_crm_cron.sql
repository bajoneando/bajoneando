-- 1. Asegurar que la extensión pg_cron y pg_net existan (requerido para llamadas HTTP desde Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Crear función para procesar y despachar seguimientos de CRM Automatizado
CREATE OR REPLACE FUNCTION public.process_automated_crm()
RETURNS void AS $$
DECLARE
    crm_config JSONB;
    nivel JSONB;
    dias_espera INT;
    plantilla TEXT;
    usa_variables BOOLEAN;
    variables_str TEXT;
    
    r_pedido RECORD;
    webhook_url TEXT := 'https://api.wepi.com.ar/whatsapp/send-crm-template'; -- CAMBIAR POR URL REAL DEL SERVIDOR Node.js
    webhook_secret TEXT := 'YOUR_WEBHOOK_SECRET'; -- SEGURIDAD
BEGIN
    -- Obtener la configuración del CRM
    SELECT flow_data->'crm_automatizado' INTO crm_config 
    FROM public.whatsapp_bot_flows 
    WHERE id = 'main_flow';

    -- Si no está habilitado globalmente, abortar
    IF NOT (crm_config->>'enabled')::boolean THEN
        RETURN;
    END IF;

    -- Iterar sobre cada nivel configurado
    FOR nivel IN SELECT * FROM jsonb_array_elements(crm_config->'niveles') LOOP
        
        -- Si el nivel está habilitado
        IF (nivel->>'enabled')::boolean THEN
            dias_espera := (nivel->>'dias_espera')::int;
            plantilla := nivel->>'plantilla_meta';
            usa_variables := (nivel->>'usa_variables')::boolean;
            variables_str := nivel->>'variables';

            -- Buscar pedidos entregados hace exactamente 'dias_espera' días
            FOR r_pedido IN 
                SELECT p.id, p.user_id, u.telefono, u.nombre, p.ciudad
                FROM public.pedidos p
                JOIN public.usuarios u ON u.id = p.user_id
                WHERE p.estado = 'Entregado'
                  AND DATE(p.updated_at) = CURRENT_DATE - (dias_espera || ' days')::interval
            LOOP
                
                -- Si hay un teléfono válido
                IF r_pedido.telefono IS NOT NULL THEN
                    
                    -- Llamada HTTP mediante pg_net hacia el servidor Node.js
                    -- El servidor Node.js se encargará de despachar el mensaje a Meta
                    PERFORM net.http_post(
                        url := webhook_url,
                        headers := jsonb_build_object(
                            'Content-Type', 'application/json',
                            'Authorization', 'Bearer ' || webhook_secret
                        ),
                        body := jsonb_build_object(
                            'telefono', r_pedido.telefono,
                            'plantilla_meta', plantilla,
                            'pedido_id', r_pedido.id,
                            'nombre', r_pedido.nombre,
                            'ciudad', r_pedido.ciudad,
                            'usa_variables', usa_variables,
                            'variables_config', variables_str
                        )
                    );
                    
                END IF;

            END LOOP;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Programar el Cron Job para ejecutarse todos los días a las 14:00 hrs
-- Puedes ajustar el horario cron (ej: '0 14 * * *' = 14:00 PM)
SELECT cron.schedule(
    'crm_automatizado_diario',
    '0 14 * * *',
    $$ SELECT public.process_automated_crm(); $$
);
