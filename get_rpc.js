require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getRpc() {
  // Query pg_proc to get the source code of create_pedido_completo
  const { data, error } = await supabase.rpc('get_function_def', { function_name: 'create_pedido_completo' });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log(data);
  }
}
getRpc();
