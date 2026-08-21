-- ═══════════════════════════════════════════════════
-- MIGRATION: admin_force_update_pedido_status RPC
-- Permite forzar el cambio de estado saltándose los triggers sentinel
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_force_update_pedido_status(
  p_pedido_id TEXT,
  p_estado TEXT
)
RETURNS VOID AS $$
BEGIN
  -- 1. Desactivar temporalmente los triggers de sentinel de estado
  ALTER TABLE public.pedidos_general DISABLE TRIGGER trg_state_sentinel;
  ALTER TABLE public.pedidos_locales DISABLE TRIGGER trg_state_sentinel_local;
  
  -- 2. Forzar el estado y registrar fechas correspondientes
  UPDATE public.pedidos_general
  SET 
    estado = p_estado,
    fecha_confirmado = CASE WHEN p_estado = 'Confirmado' THEN COALESCE(fecha_confirmado, NOW()) ELSE fecha_confirmado END,
    fecha_entregado = CASE WHEN p_estado = 'Entregado' THEN COALESCE(fecha_entregado, NOW()) ELSE fecha_entregado END
  WHERE id = p_pedido_id;
  
  -- 3. Forzar el estado en pedidos_locales
  UPDATE public.pedidos_locales
  SET estado = p_estado
  WHERE pedido_id = p_pedido_id;
  
  -- 4. Reactivar los triggers
  ALTER TABLE public.pedidos_general ENABLE TRIGGER trg_state_sentinel;
  ALTER TABLE public.pedidos_locales ENABLE TRIGGER trg_state_sentinel_local;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
