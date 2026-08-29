import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const payload = await req.json()
    console.log('[Webhook MP] Notificación recibida:', JSON.stringify(payload))

    // 1. Extraer ID (Soporta múltiples formatos de Mercado Pago)
    let id = payload?.data?.id || payload?.id
    if (!id && payload?.resource) {
      id = payload.resource.split('/').pop()
    }

    const type = payload?.type || payload?.action || payload?.topic || 'payment'
    const localId = new URL(req.url).searchParams.get('local_id')

    if (!id || isNaN(Number(id))) {
      return new Response(JSON.stringify({ message: "No valid id" }), { status: 200 })
    }

    // 2. Obtener Tokens y recuperar el pago
    const { data: localData } = await supabase.from('locales').select('mp_access_token').eq('id', localId).single()
    const MP_GLOBAL = Deno.env.get('MP_ACCESS_TOKEN_GLOBAL')
    const masterToken = 'APP_USR-595288641172928-010710-d915bce4137b3ee26e0c6e04873f1ac1-695835795'
    
    const tokenList = [localData?.mp_access_token, MP_GLOBAL, masterToken].filter(Boolean)
    
    let paymentData = null
    for (const token of tokenList) {
      try {
        const resp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
        if (resp.ok) {
          paymentData = await resp.json()
          break
        }
      } catch (e) {
        console.error(`[Webhook MP] Error consultando con token:`, e.message)
      }
    }

    if (!paymentData) {
      console.error(`[Webhook MP] Pago ${id} no encontrado en ninguna cuenta de MP`)
      return new Response(JSON.stringify({ error: "Payment not found" }), { status: 200 })
    }

    const status = paymentData.status
    const externalReference = paymentData.external_reference
    console.log(`[Webhook MP] Pago ${id} estado: ${status}, Ref: ${externalReference}`)

    // 3. Si está aprobado, procesar la confirmación
    if (status === 'approved' && externalReference) {
      // Intentar obtener el temporal
      const { data: tempOrder } = await supabase.from('pedidos_temporales').select('*').eq('id', externalReference).single()

      if (tempOrder) {
        console.log(`[Webhook MP] Procesando pedido temporal ${externalReference}`)
        // 4. Ejecutar el RPC oficial (crea el pedido final)
        const { error: rpcError } = await supabase.rpc('create_pedido_completo', {
          p_user_id: tempOrder.usuario_id,
          p_direccion: tempOrder.order_info.direccion,
          p_metodo_pago: tempOrder.order_info.metodoPago,
          p_observaciones: tempOrder.order_info.observaciones || '',
          p_tipo_entrega: tempOrder.order_info.tipoEntrega,
          p_total: tempOrder.order_info.totalCalculado,
          p_estado: 'Confirmado',
          p_email_cliente: tempOrder.order_info.emailCliente || '',
          p_nombre_cliente: tempOrder.order_info.nombreCliente || '',
          p_lat: tempOrder.order_info.lat,
          p_lng: tempOrder.order_info.lng,
          p_cart: tempOrder.cart_data,
          p_precio_envio: tempOrder.order_info.precioEnvio || 0,
          p_id: externalReference,
          p_external_reference: externalReference,
          p_fee_envio: tempOrder.order_info.feeEnvio || 0
        })

        if (rpcError) {
          console.error(`[Webhook MP] Error al crear pedido final via RPC:`, rpcError)
          // No retornamos error aquí para permitir que el flujo de actualización intente arreglarlo abajo
        }

        // 5. Limpiar temporales
        await supabase.from('pedidos_temporales').delete().eq('id', externalReference)
      } else {
        console.log(`[Webhook MP] Pedido temporal no encontrado. Verificando si ya existe en pedidos_general...`)
      }

      // 6. ASEGURAR ACTUALIZACIÓN (Fallback Robusto con Seguro)
      // Antes de forzar el estado a 'Confirmado', verificamos que no esté en un estado avanzado.
      const { data: currentOrder } = await supabase.from('pedidos_general').select('estado').eq('id', externalReference).single();
      
      const safeToConfirm = !currentOrder || 
        ['Pendiente', 'Pendiente de Pago', 'Buscando Repartidor', null].includes(currentOrder.estado as any);

      if (safeToConfirm) {
        const { error: updateError } = await supabase.from('pedidos_general').update({ 
          estado: 'Confirmado',
          payment_id: String(id),
          fecha_pago: new Date().toISOString()
        }).eq('id', externalReference)

        if (updateError) {
          console.error(`[Webhook MP] Error actualizando estado en pedidos_general:`, updateError)
        } else {
          // También actualizar locales para el dashboard/impresora
          await supabase.from('pedidos_locales').update({ estado: 'Confirmado' }).eq('pedido_id', externalReference)
          console.log(`[Webhook MP] Pedido ${externalReference} confirmado con éxito.`)
        }
      } else {
        console.log(`[Webhook MP] Pedido ${externalReference} ya está en estado ${currentOrder.estado}. Omitiendo cambio a Confirmado.`)
        
        // Aún así actualizamos el payment_id si no lo tiene, sin cambiar el estado
        await supabase.from('pedidos_general').update({ 
          payment_id: String(id),
          fecha_pago: new Date().toISOString()
        }).eq('id', externalReference).is('payment_id', null)
      }
    }

    return new Response(JSON.stringify({ message: "OK" }), { status: 200 })

  } catch (err) {
    console.error('[Webhook MP] Error Fatal:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 200 })
  }
})
