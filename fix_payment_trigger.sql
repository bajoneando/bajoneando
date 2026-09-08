-- ==============================================================================
-- FIX: Liberar el bloqueo de estado en pedidos_general
-- El trigger anterior bloqueaba CUALQUIER cambio de estado una vez confirmado.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_payment_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actuar si se está asignando un payment_id por primera vez
  IF (NEW.payment_id IS NOT NULL AND OLD.payment_id IS NULL) THEN
      -- SEGURIDAD: Si el pedido ya está en un estado avanzado, no sobreescribirlo.
      IF (OLD.estado IN ('Confirmado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado', 'Rechazado', 'Cancelado')) THEN
          -- Mantener el estado actual (no hacer nada con NEW.estado)
      ELSE
          -- Si estaba pendiente, pasarlo a Confirmado
          NEW.estado := 'Confirmado';
          UPDATE public.pedidos_locales SET estado = 'Confirmado' WHERE pedido_id = NEW.id;
          IF (NEW.fecha_pago IS NULL) THEN
            NEW.fecha_pago := NOW();
          END IF;
      END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
