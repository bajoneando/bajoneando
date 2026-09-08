-- ==============================================================================
-- FIX: Permitir a los dueños de locales rechazar sus propios pedidos de prueba
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

    -- Bloqueo de cancelación por parte del cliente si ya está aceptado
    IF (OLD.estado IN ('Confirmado', 'Aceptado') AND NEW.estado IN ('Rechazado', 'Cancelado')) THEN
        -- Si el que cancela es el cliente...
        IF (auth.uid() = OLD.usuario_id) THEN
            -- Excepción: Si el cliente también es dueño de un local (es decir, está haciendo una prueba), se lo permitimos.
            IF NOT EXISTS (SELECT 1 FROM public.locales WHERE admin_id = auth.uid() OR encargado_id = auth.uid()) THEN
                NEW.estado := OLD.estado;
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
