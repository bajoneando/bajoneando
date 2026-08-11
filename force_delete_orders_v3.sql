-- ==============================================================================
-- SCRIPT: Eliminación Forzada de Pedidos (v3)
-- Objetivo: Eliminar registros de pedidos_general, pedidos_locales y pedidos_items
--           desactivando únicamente los triggers de usuario para evitar bloqueos.
-- ==============================================================================

BEGIN;

-- 1. Desactivar temporalmente los triggers de usuario (evita errores con triggers del sistema)
ALTER TABLE public.pedidos_items DISABLE TRIGGER USER;
ALTER TABLE public.pedidos_locales DISABLE TRIGGER USER;
ALTER TABLE public.pedidos_general DISABLE TRIGGER USER;

-- 2. Eliminar registros de pedidos_items (Hijos)
DELETE FROM public.pedidos_items 
WHERE pedido_id IN (
  'ORD-1LDDSWHG8U',
  'ORD-35R3FXQ44H',
  'ORD-47AXV2T47B',
  'ORD-5UC33GDPPC',
  'ORD-620HPEDPVL',
  'ORD-6YN27ZIAPK',
  'ORD-9L4NRDGRRP',
  'ORD-ATGFELMTJ0',
  'ORD-B6YS3WXWOF',
  'ORD-B7JDC6MUGE',
  'ORD-BDVELEV6LM',
  'ORD-C3HXS9X4CY',
  'ORD-CQAJSJF3W2',
  'ORD-CTHOC3Z2CY',
  'ORD-DHIFGFPGK2',
  'ORD-EAGO4RKVVF',
  'ORD-GYH9RCY9YO',
  'ORD-I3H1H919I6',
  'ORD-JGL5EYIVEK',
  'ORD-LBQZXGUMWL',
  'ORD-LSJHZ2G1FE',
  'ORD-LW7HQ2ME6N',
  'ORD-NBEEMEAC36',
  'ORD-PI28LZS72Y',
  'ORD-PIKHNVXKFR',
  'ORD-QEGT80EB3F',
  'ORD-QF87YJTFBP',
  'ORD-R01I8G9EI5',
  'ORD-SOVNFJHW45',
  'ORD-TYJVL5VFXV',
  'ORD-U5IVA0FZBF',
  'ORD-WLJ005I1IN',
  'ORD-YIDSQEI4Y7',
  'ORD-YZPJGPN3E6',
  'ORD-Z4PW68949F',
  'ORD-ZOOZRNY5KQ'
);

-- 3. Eliminar registros de pedidos_locales (Hijos)
DELETE FROM public.pedidos_locales 
WHERE pedido_id IN (
  'ORD-1LDDSWHG8U',
  'ORD-35R3FXQ44H',
  'ORD-47AXV2T47B',
  'ORD-5UC33GDPPC',
  'ORD-620HPEDPVL',
  'ORD-6YN27ZIAPK',
  'ORD-9L4NRDGRRP',
  'ORD-ATGFELMTJ0',
  'ORD-B6YS3WXWOF',
  'ORD-B7JDC6MUGE',
  'ORD-BDVELEV6LM',
  'ORD-C3HXS9X4CY',
  'ORD-CQAJSJF3W2',
  'ORD-CTHOC3Z2CY',
  'ORD-DHIFGFPGK2',
  'ORD-EAGO4RKVVF',
  'ORD-GYH9RCY9YO',
  'ORD-I3H1H919I6',
  'ORD-JGL5EYIVEK',
  'ORD-LBQZXGUMWL',
  'ORD-LSJHZ2G1FE',
  'ORD-LW7HQ2ME6N',
  'ORD-NBEEMEAC36',
  'ORD-PI28LZS72Y',
  'ORD-PIKHNVXKFR',
  'ORD-QEGT80EB3F',
  'ORD-QF87YJTFBP',
  'ORD-R01I8G9EI5',
  'ORD-SOVNFJHW45',
  'ORD-TYJVL5VFXV',
  'ORD-U5IVA0FZBF',
  'ORD-WLJ005I1IN',
  'ORD-YIDSQEI4Y7',
  'ORD-YZPJGPN3E6',
  'ORD-Z4PW68949F',
  'ORD-ZOOZRNY5KQ'
);

-- 4. Eliminar de pedidos_general (Tabla Principal)
DELETE FROM public.pedidos_general 
WHERE id IN (
  'ORD-1LDDSWHG8U',
  'ORD-35R3FXQ44H',
  'ORD-47AXV2T47B',
  'ORD-5UC33GDPPC',
  'ORD-620HPEDPVL',
  'ORD-6YN27ZIAPK',
  'ORD-9L4NRDGRRP',
  'ORD-ATGFELMTJ0',
  'ORD-B6YS3WXWOF',
  'ORD-B7JDC6MUGE',
  'ORD-BDVELEV6LM',
  'ORD-C3HXS9X4CY',
  'ORD-CQAJSJF3W2',
  'ORD-CTHOC3Z2CY',
  'ORD-DHIFGFPGK2',
  'ORD-EAGO4RKVVF',
  'ORD-GYH9RCY9YO',
  'ORD-I3H1H919I6',
  'ORD-JGL5EYIVEK',
  'ORD-LBQZXGUMWL',
  'ORD-LSJHZ2G1FE',
  'ORD-LW7HQ2ME6N',
  'ORD-NBEEMEAC36',
  'ORD-PI28LZS72Y',
  'ORD-PIKHNVXKFR',
  'ORD-QEGT80EB3F',
  'ORD-QF87YJTFBP',
  'ORD-R01I8G9EI5',
  'ORD-SOVNFJHW45',
  'ORD-TYJVL5VFXV',
  'ORD-U5IVA0FZBF',
  'ORD-WLJ005I1IN',
  'ORD-YIDSQEI4Y7',
  'ORD-YZPJGPN3E6',
  'ORD-Z4PW68949F',
  'ORD-ZOOZRNY5KQ'
);

-- 5. Reactivar todos los triggers de usuario
ALTER TABLE public.pedidos_items ENABLE TRIGGER USER;
ALTER TABLE public.pedidos_locales ENABLE TRIGGER USER;
ALTER TABLE public.pedidos_general ENABLE TRIGGER USER;

COMMIT;
