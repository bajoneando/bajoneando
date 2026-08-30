-- 1. DROP all possible variants of create_pedido_completo
DROP FUNCTION IF EXISTS public.create_pedido_completo(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, NUMERIC, TEXT, TEXT, UUID, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.create_pedido_completo(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, NUMERIC, TEXT, TEXT, UUID, NUMERIC, JSONB, NUMERIC);
DROP FUNCTION IF EXISTS public.create_pedido_completo(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, NUMERIC, TEXT, TEXT, UUID, NUMERIC, JSONB, NUMERIC, NUMERIC);

-- 2. CREATE the single correct function with all 20 parameters and their defaults
CREATE OR REPLACE FUNCTION public.create_pedido_completo(
  p_user_id TEXT,
  p_direccion TEXT,
  p_metodo_pago TEXT,
  p_observaciones TEXT,
  p_tipo_entrega TEXT,
  p_total NUMERIC,
  p_estado TEXT,
  p_email_cliente TEXT,
  p_nombre_cliente TEXT,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_cart JSONB,
  p_precio_envio NUMERIC DEFAULT 0,
  p_id TEXT DEFAULT NULL,
  p_external_reference TEXT DEFAULT NULL,
  p_cupon_id UUID DEFAULT NULL,
  p_descuento_cupon NUMERIC DEFAULT 0,
  p_promociones_aplicadas JSONB DEFAULT '[]'::jsonb,
  p_ganancia_credito NUMERIC DEFAULT 0,
  p_fee_envio NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_pedido_id TEXT;
  v_num_confirmacion TEXT;
  v_local_id TEXT;
  v_repartidor_id TEXT;
  v_ped_local_id TEXT;
BEGIN
    -- No EXCEPTION block so that errors propagate and roll back correctly!
    -- 1. Definir ID y PIN
    v_pedido_id := COALESCE(p_id, 'PED-' || (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT::TEXT);
    v_num_confirmacion := floor(random() * 9000 + 1000)::TEXT;
    v_local_id := COALESCE(p_cart->0->>'local_id', 'unknown');

    -- 2. ASIGNACIÓN DE REPARTIDOR
    v_repartidor_id := NULL;

    -- 3. Registrar en pedidos_general
    INSERT INTO pedidos_general (
        id, usuario_id, direccion, estado, total, metodo_pago, observaciones, 
        tipo_entrega, email_cliente, nombre_cliente, lat, lng, repartidor_id, 
        local_id, num_confirmacion, fecha, created_at, precio_envio, 
        cobro_repartidor_procesado, external_reference, cupon_id, descuento_cupon, 
        promociones_aplicadas, ganancia_credito, fee_envio
    ) VALUES (
        v_pedido_id, p_user_id, p_direccion, p_estado, p_total, p_metodo_pago, p_observaciones, 
        p_tipo_entrega, p_email_cliente, p_nombre_cliente, p_lat, p_lng, v_repartidor_id, 
        v_local_id, v_num_confirmacion, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', 
        p_precio_envio, (LOWER(p_metodo_pago) = 'efectivo'), p_external_reference,
        p_cupon_id, p_descuento_cupon, 
        p_promociones_aplicadas, p_ganancia_credito, p_fee_envio
    );

    -- 4. Incrementar uso de cupón si existe
    IF p_cupon_id IS NOT NULL THEN
        UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = p_cupon_id;
    END IF;

    -- 5. Registrar en pedidos_locales
    v_ped_local_id := 'PL-' || v_pedido_id;
    INSERT INTO pedidos_locales (id, pedido_id, local_id, estado, created_at, metodo_pago, total)
    VALUES (v_ped_local_id, v_pedido_id, v_local_id, 'Pendiente', NOW() - INTERVAL '3 hours', LOWER(p_metodo_pago), p_total);

    INSERT INTO pedidos_items (pedido_id, local_id, pedido_local_id, item_id, nombre, cantidad, precio_unitario, subtotal, variantes_notas)
    SELECT 
        v_pedido_id,
        v_local_id,
        v_ped_local_id,
        COALESCE(item->>'id', item->>'menuId'),
        CASE 
            WHEN item->>'descripcion' IS NOT NULL THEN (item->>'nombre') || ' (' || (item->>'descripcion') || ')'
            ELSE COALESCE(item->>'nombre', 'Item')
        END,
        (item->>'qty')::INTEGER,
        (item->>'precio')::NUMERIC,
        ((item->>'qty')::INTEGER) * ((item->>'precio')::NUMERIC),
        COALESCE(item->>'comentario', '')
    FROM jsonb_array_elements(p_cart) AS item;

    RETURN jsonb_build_object(
        'success', true, 
        'pedidoId', v_pedido_id, 
        'numConfirmacion', v_num_confirmacion
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
