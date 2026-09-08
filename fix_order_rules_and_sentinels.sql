-- ==============================================================================
-- WEEP - ACTUALIZACIÓN DE SENTINELS Y REGLAS DE NEGOCIO
-- Asegura el cumplimiento de los flujos de Locales, Repartidores y Admins.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX: TRIGGER DE CONFIRMACIÓN DE PAGOS
-- Permite que los pagos confirmen el pedido, sin bloquear futuras actualizaciones de estado.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_payment_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo evaluar esta regla si lo que ingresa es estrictamente la confirmación de un pago
  IF (NEW.payment_id IS NOT NULL AND OLD.payment_id IS NULL) THEN
      -- Si es un pago demorado y el pedido ya avanzó, ignoramos la confirmación del estado
      IF (OLD.estado IN ('Confirmado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado', 'Rechazado', 'Cancelado')) THEN
          -- No modificamos NEW.estado, se mantiene su curso natural
      ELSE
          -- Si estaba pendiente, lo pasamos a Confirmado
          NEW.estado := 'Confirmado';
          UPDATE public.pedidos_locales SET estado = 'Confirmado' WHERE pedido_id = NEW.id;
          IF (NEW.fecha_pago IS NULL) THEN
            NEW.fecha_pago := NOW();
          END IF;
      END IF;
  END IF;
  
  -- Para cualquier otra actualización, no intervenimos.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- 2. FIX: SENTINEL DE LA TABLA PEDIDOS_GENERAL
-- Respeta flujos, estados finales, y permite a locales rechazar.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_order_state_transition_general()
RETURNS TRIGGER AS $$
BEGIN
    -- REGLA A: Estados finales (Entregado, Cancelado, Rechazado) son inmutables.
    -- (Nota: /admin puede bypassear esto usando su RPC especial).
    IF (OLD.estado IN ('Entregado', 'Cancelado', 'Rechazado')) THEN
        IF (NEW.estado IS DISTINCT FROM OLD.estado) THEN
            NEW.estado := OLD.estado;
        END IF;
        RETURN NEW;
    END IF;

    -- REGLA B: Anti-regresión. No se puede volver de estados avanzados a iniciales.
    IF (OLD.estado IN ('Listo', 'Retirado', 'En camino') AND NEW.estado IN ('Confirmado', 'Pendiente', 'Pendiente de Pago', 'Buscando Repartidor')) THEN
        NEW.estado := OLD.estado;
        RETURN NEW;
    END IF;

    -- REGLA C: Bloqueo de cancelación automática o por parte del cliente.
    IF (OLD.estado IN ('Confirmado', 'Aceptado', 'Preparando') AND NEW.estado IN ('Rechazado', 'Cancelado')) THEN
        -- Si el que intenta cancelar es el propio cliente (o el sistema ejecutando como cliente)...
        IF (auth.uid() = OLD.usuario_id) THEN
            -- EXCEPCIÓN: Si el usuario actual tiene un local (es dueño o encargado), 
            -- significa que está haciendo una prueba, por lo tanto le permitimos el cambio.
            IF NOT EXISTS (SELECT 1 FROM public.locales WHERE admin_id = auth.uid() OR encargado_id = auth.uid()) THEN
                -- Si es un cliente normal, bloqueamos la cancelación de un pedido ya confirmado.
                NEW.estado := OLD.estado;
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- 3. FIX: SENTINEL DE LA TABLA PEDIDOS_LOCALES
-- Mantiene coherencia local sin verificar usuario_id (columna inexistente).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_order_state_transition_local()
RETURNS TRIGGER AS $$
BEGIN
    -- REGLA A: Estados finales
    IF (OLD.estado IN ('Entregado', 'Cancelado', 'Rechazado')) THEN
        IF (NEW.estado IS DISTINCT FROM OLD.estado) THEN
            NEW.estado := OLD.estado;
        END IF;
        RETURN NEW;
    END IF;

    -- REGLA B: Anti-regresión
    IF (OLD.estado IN ('Listo', 'Retirado', 'En camino') AND NEW.estado IN ('Confirmado', 'Pendiente', 'Pendiente de Pago', 'Buscando Repartidor')) THEN
        NEW.estado := OLD.estado;
        RETURN NEW;
    END IF;

    -- Los cambios de Confirmado -> Rechazado están permitidos en esta tabla 
    -- ya que solo el sistema/comercio pueden actualizarla.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- 4. APLICACIÓN DE LOS TRIGGERS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_confirm_order_on_payment ON public.pedidos_general;
CREATE TRIGGER trg_confirm_order_on_payment
BEFORE UPDATE ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_confirmation();

DROP TRIGGER IF EXISTS trg_state_sentinel ON public.pedidos_general;
CREATE TRIGGER trg_state_sentinel
BEFORE UPDATE OF estado ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.check_order_state_transition_general();

DROP TRIGGER IF EXISTS trg_state_sentinel_local ON public.pedidos_locales;
CREATE TRIGGER trg_state_sentinel_local
BEFORE UPDATE OF estado ON public.pedidos_locales
FOR EACH ROW
EXECUTE FUNCTION public.check_order_state_transition_local();
