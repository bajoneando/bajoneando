-- ==============================================================================
-- FIX: Separación de triggers para pedidos_general y pedidos_locales
-- Esto evita el error: record "old" has no field "usuario_id"
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_order_state_transition_general()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.estado IN ('Entregado', 'Cancelado', 'Rechazado')) THEN
        IF (NEW.estado IS DISTINCT FROM OLD.estado) THEN
            NEW.estado := OLD.estado;
        END IF;
        RETURN NEW;
    END IF;

    IF (OLD.estado IN ('Listo', 'Retirado', 'En camino') AND NEW.estado IN ('Confirmado', 'Pendiente', 'Pendiente de Pago', 'Buscando Repartidor')) THEN
        NEW.estado := OLD.estado;
        RETURN NEW;
    END IF;

    IF (OLD.estado IN ('Confirmado', 'Aceptado') AND NEW.estado IN ('Rechazado', 'Cancelado')) THEN
        IF (auth.uid() = OLD.usuario_id) THEN
            NEW.estado := OLD.estado;
            RETURN NEW;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.check_order_state_transition_local()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.estado IN ('Entregado', 'Cancelado', 'Rechazado')) THEN
        IF (NEW.estado IS DISTINCT FROM OLD.estado) THEN
            NEW.estado := OLD.estado;
        END IF;
        RETURN NEW;
    END IF;

    IF (OLD.estado IN ('Listo', 'Retirado', 'En camino') AND NEW.estado IN ('Confirmado', 'Pendiente', 'Pendiente de Pago', 'Buscando Repartidor')) THEN
        NEW.estado := OLD.estado;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reasignar trigger general
DROP TRIGGER IF EXISTS trg_state_sentinel ON public.pedidos_general;
CREATE TRIGGER trg_state_sentinel
BEFORE UPDATE OF estado ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.check_order_state_transition_general();

-- Reasignar trigger local con la funcion que NO verifica usuario_id
DROP TRIGGER IF EXISTS trg_state_sentinel_local ON public.pedidos_locales;
CREATE TRIGGER trg_state_sentinel_local
BEFORE UPDATE OF estado ON public.pedidos_locales
FOR EACH ROW
EXECUTE FUNCTION public.check_order_state_transition_local();
