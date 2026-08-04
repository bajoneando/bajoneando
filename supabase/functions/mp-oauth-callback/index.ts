import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // Este será el ID del local

  if (!code || !state) {
    return new Response('Faltan parámetros code o state', { status: 400 })
  }

  try {
    const clientId = Deno.env.get('MP_CLIENT_ID')?.trim()
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET')?.trim()
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-oauth-callback`
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'

    if (!clientId || !clientSecret) {
      throw new Error("MP_CLIENT_ID o MP_CLIENT_SECRET no configurados")
    }

    // Intercambiar el código por el token de acceso
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_secret: clientSecret,
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('Error de Mercado Pago:', tokenData)
      return Response.redirect(`${frontendUrl}/locales?mpoauth=error&message=token_exchange_failed`, 302)
    }

    // Actualizar el local en la base de datos
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceRole)

    const expiresIn = tokenData.expires_in || 15552000 // 180 días por defecto
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Obtener información extendida del usuario de MP
    let mpUserInfo = null
    try {
      const userRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      })
      const uData = await userRes.json()
      if (uData && uData.id) {
        mpUserInfo = {
          id: uData.id,
          nickname: uData.nickname,
          email: uData.email,
          first_name: uData.first_name,
          last_name: uData.last_name,
          brand_name: uData.company?.brand_name
        }
      }
    } catch (e) {
      console.warn('No se pudieron obtener datos extendidos de usuario MP:', e)
    }

    // Obtener sync_config_data previo para no sobrescribir
    const { data: existingLocal } = await supabase.from('locales').select('sync_config_data').eq('id', state).single()
    const syncData = existingLocal?.sync_config_data || {}
    if (mpUserInfo) {
      syncData.mp_user_info = mpUserInfo
    }

    const { error: updateError } = await supabase
      .from('locales')
      .update({
        mp_access_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token,
        mp_public_key: tokenData.public_key,
        mp_user_id: tokenData.user_id?.toString(),
        mp_token_expires_at: expiresAt,
        sync_config_data: syncData
      })
      .eq('id', state)

    if (updateError) {
      console.error('Error guardando en Supabase:', updateError)
      return Response.redirect(`${frontendUrl}/locales?mpoauth=error&message=db_update_failed`, 302)
    }

    // Redirigir al frontend con éxito
    return Response.redirect(`${frontendUrl}/locales?mpoauth=success`, 302)

  } catch (err) {
    console.error('Error en oauth callback:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
