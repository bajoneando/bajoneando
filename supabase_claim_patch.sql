-- ═══════════════════════════════════════════════════
-- PATCH: claim_pedido_broadcast para flujo de pagos
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.claim_pedido_broadcast(
  p_pedido_id TEXT,
  p_repartidor_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_updated INT;
  v_current_estado TEXT;
  v_target_estado TEXT;
  v_created_at TIMESTAMPTZ;
  v_segundos INT;
  v_puntos_base INT := 0;
  v_cycle_id TEXT;
  v_metodo_pago TEXT;
    v_payment_id TEXT;
BEGIN
    -- 1. Obtener estado actual y datos de pago
    SELECT estado, created_at, metodo_pago, payment_id 
    INTO v_current_estado, v_created_at, v_metodo_pago, v_payment_id
    FROM public.pedidos_general 
    WHERE id = p_pedido_id AND repartidor_id IS NULL;

    IF v_current_estado IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El pedido ya no está disponible.');
    END IF;

    -- 2. Definir estado de destino
    -- Si está en 'Buscando Repartidor' o 'Pendiente', evaluar el pago
    IF v_current_estado IN ('Buscando Repartidor', 'Pendiente') THEN
        IF LOWER(v_metodo_pago) LIKE '%efectivo%' OR v_payment_id IS NOT NULL THEN
            v_target_estado := 'Confirmado';
        ELSE
            v_target_estado := 'Pendiente de Pago';
        END IF;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'El pedido no puede ser reclamado en su estado actual: ' || v_current_estado);
    END IF;

    -- 3. Intentar actualizar de forma atómica
    UPDATE public.pedidos_general 
    SET repartidor_id = p_repartidor_id, 
        estado = v_target_estado
    WHERE id = p_pedido_id 
      AND repartidor_id IS NULL 
      AND estado = v_current_estado
      AND tipo_entrega = 'Con Envío';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'El pedido ya fue tomado por otro repartidor.');
    END IF;

    -- 4. Actualizar pedidos_locales opcionalmente (sincronizar estados)
    UPDATE public.pedidos_locales SET estado = v_target_estado WHERE pedido_id = p_pedido_id;

    -- 5. Lógica de Gamificación
    BEGIN
        v_segundos := EXTRACT(EPOCH FROM (NOW() - v_created_at));

        -- Bonus de Rapidez: +75 puntos si lo toma en menos de 45 seg
        IF v_segundos <= 45 THEN
          v_puntos_base := v_puntos_base + 75;
          INSERT INTO public.driver_points_log (driver_id, puntos, motivo)
          VALUES (p_repartidor_id, 75, 'BROADCAST_FLASH');
        END IF;

        -- Verificar si hay un ciclo de incentivo activo
        SELECT current_cycle_id INTO v_cycle_id FROM public.system_activation_status WHERE id = 1;
        IF v_cycle_id IS NOT NULL THEN
          v_puntos_base := v_puntos_base + 100;
          INSERT INTO public.driver_points_log (driver_id, cycle_id, puntos, motivo)
          VALUES (p_repartidor_id, v_cycle_id, 100, 'BROADCAST_INCENTIVE');
        END IF;

        -- Actualizar estadísticas generales
        IF v_puntos_base > 0 THEN
          INSERT INTO public.driver_gamification_stats (driver_id, puntos_totales, puntos_canjeables)
          VALUES (p_repartidor_id, v_puntos_base, v_puntos_base)
          ON CONFLICT (driver_id) DO UPDATE 
          SET puntos_totales = public.driver_gamification_stats.puntos_totales + v_puntos_base,
              puntos_canjeables = public.driver_gamification_stats.puntos_canjeables + v_puntos_base;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error en gamificación broadcast: %', SQLERRM;
    END;

    -- 6. Marcar repartidor como Ocupado
    UPDATE public.repartidores SET estado = 'Ocupado' WHERE id = p_repartidor_id;

    RETURN jsonb_build_object('success', true, 'mensaje', 'Pedido asignado con éxito', 'nuevo_estado', v_target_estado);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
