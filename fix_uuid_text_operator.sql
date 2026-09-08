-- ==============================================================================
-- FIX: Error de casting (operator does not exist: uuid = text)
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

    IF (OLD.estado IN ('Confirmado', 'Aceptado', 'Preparando') AND NEW.estado IN ('Rechazado', 'Cancelado')) THEN
        -- Castear auth.uid() a texto para evitar el error: operator does not exist: uuid = text
        IF (auth.uid()::text = OLD.usuario_id) THEN
            IF NOT EXISTS (SELECT 1 FROM public.locales WHERE admin_id = auth.uid()::text OR encargado_id = auth.uid()::text) THEN
                NEW.estado := OLD.estado;
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
