-- ==============================================================================
-- WEEP - Limpieza Automática de Pedidos Abandonados o Sin Repartidor
-- ==============================================================================

-- 1. Asegurar que las extensiones requeridas estén habilitadas
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Función para limpiar pedidos estancados
CREATE OR REPLACE FUNCTION public.fn_cleanup_stale_orders()
RETURNS void AS $$
BEGIN
  -- A. Cancelar pedidos en "Buscando Repartidor" por más de 12 minutos
  -- (El cliente usualmente tiene un timeout de 1-2 min, pero damos margen por reintentos)
  UPDATE public.pedidos_general
  SET estado = 'Rechazado'
  WHERE estado = 'Buscando Repartidor'
    AND created_at <= NOW() - INTERVAL '12 minutes';

  -- B. Cancelar pedidos en "Pendiente de Pago" por más de 8 minutos
  -- (El usuario probablemente cerró la pestaña o abandonó el checkout de MP)
  -- Importante: Liberar también al repartidor asignado.
  
  -- Para los repartidores asignados a estos pedidos abandonados:
  UPDATE public.repartidores
  SET estado = 'Activo'
  WHERE id IN (
    SELECT repartidor_id FROM public.pedidos_general 
    WHERE estado = 'Pendiente de Pago' 
      AND COALESCE(pago_pendiente_at, NOW()) <= NOW() - INTERVAL '8 minutes'
  );

  -- Marcamos el pedido como Rechazado
  UPDATE public.pedidos_general
  SET estado = 'Rechazado'
  WHERE estado = 'Pendiente de Pago'
    AND COALESCE(pago_pendiente_at, NOW()) <= NOW() - INTERVAL '8 minutes';

END;
$$ LANGUAGE plpgsql;

-- 3. Programar el CRON JOB cada 5 minutos
SELECT cron.schedule(
  'cleanup-stale-orders',
  '*/5 * * * *',
  'SELECT public.fn_cleanup_stale_orders()'
);
