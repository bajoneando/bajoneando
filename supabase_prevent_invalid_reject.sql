-- Función para proteger pedidos_general
CREATE OR REPLACE FUNCTION prevent_customer_invalid_reject()
RETURNS trigger AS $$
BEGIN
  -- Verificar si el estado está cambiando a 'Rechazado'
  IF NEW.estado = 'Rechazado' AND OLD.estado IS DISTINCT FROM 'Rechazado' THEN
    
    -- Verificar si el pedido ya está en una etapa irreversible
    IF OLD.estado IN ('Confirmado', 'Aceptado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado') THEN
      
      -- Si el usuario que intenta hacer el rechazo es el propio cliente (el dueño del pedido)
      IF auth.uid() = OLD.usuario_id THEN
         -- Abortar silenciosamente: devolvemos OLD para que no se apliquen los cambios de NEW
         -- pero sin arrojar error al frontend
         RETURN OLD;
      END IF;
      
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_customer_invalid_reject ON pedidos_general;
CREATE TRIGGER trigger_prevent_customer_invalid_reject
  BEFORE UPDATE ON pedidos_general
  FOR EACH ROW
  EXECUTE FUNCTION prevent_customer_invalid_reject();


-- Función para proteger pedidos_locales
CREATE OR REPLACE FUNCTION prevent_customer_invalid_reject_locales()
RETURNS trigger AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  IF NEW.estado = 'Rechazado' AND OLD.estado IS DISTINCT FROM 'Rechazado' THEN
    IF OLD.estado IN ('Confirmado', 'Aceptado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado') THEN
      -- Obtener el usuario_id del pedido general correspondiente
      SELECT usuario_id INTO v_usuario_id FROM pedidos_general WHERE id = OLD.pedido_id;
      
      IF auth.uid() = v_usuario_id THEN
         RETURN OLD;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_customer_invalid_reject_locales ON pedidos_locales;
CREATE TRIGGER trigger_prevent_customer_invalid_reject_locales
  BEFORE UPDATE ON pedidos_locales
  FOR EACH ROW
  EXECUTE FUNCTION prevent_customer_invalid_reject_locales();
