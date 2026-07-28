import nodemailer from "npm:nodemailer@6.9.13";

// @deno-types="npm:@types/nodemailer"

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, htmlBody } = await req.json()
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD")
    const gmailEmail = "bajoneando.st@gmail.com" // Cuenta proporcionada por el usuario

    if (!gmailAppPassword) {
      throw new Error("GMAIL_APP_PASSWORD is not configured in Supabase Edge Functions")
    }

    if (!to || !subject || !htmlBody) {
      throw new Error("Missing required parameters: to, subject, or htmlBody")
    }

    // Configurar el transporte SMTP para Gmail
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465, // SSL
      secure: true, // true para puerto 465
      auth: {
        user: gmailEmail,
        pass: gmailAppPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `"WEPI" <${gmailEmail}>`,
      to: [to],
      subject: subject,
      html: htmlBody,
    });

    return new Response(JSON.stringify({ success: true, id: info.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 // Mantenemos Status 200 según la estructura previa para evitar romper el cliente
    })
  }
})
