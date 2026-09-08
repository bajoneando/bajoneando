const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await sb.from('repartidores').select('nombre, fcm_token, onesignal_id').neq('fcm_token', null).limit(10);
    console.log(error ? error : data);
}
check();
