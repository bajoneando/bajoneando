const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminCRM.jsx', 'utf8');

content = content.replace(
  `{
        id: 'sin_repartidores',`,
  `{
        id: 'repartidor_encontrado_espera',
        evento: 'Repartidor encontrado en espera',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: 'Repartidor encontrado tras espera extendida',
        trigger_config: { evento_key: 'repartidor_encontrado_espera' },
        comunicacion: 'Confirmación de espera',
        enabled: true,
        canales: ['whatsapp', 'push', 'none'],
        metadata: { 
            message: 'Ya encontramos un repartidor para tu pedido, completá el pago para confirmarlo.',
            template_name: 'repartidor_encontrado_espera'
        }
    },
    {
        id: 'sin_repartidores',`
);

content = content.replace(
  `<option value="sin_repartidores">?? sin_repartidores (6. Aviso 1 Sin Repartidores)</option>`,
  `<option value="sin_repartidores">?? sin_repartidores (6. Aviso 1 Sin Repartidores)</option>\n<option value="repartidor_encontrado_espera">?? repartidor_encontrado_espera (Aviso tras 10min de espera)</option>`
);

content = content.replace(
  `<option value="sin_repartidores">sin_repartidores (1. Aviso Sin Repartidores)</option>`,
  `<option value="sin_repartidores">sin_repartidores (1. Aviso Sin Repartidores)</option>\n<option value="repartidor_encontrado_espera">repartidor_encontrado_espera (Repartidor encontrado en espera)</option>`
);

// We also need to add it to the arrays of events.
content = content.replace(/'PEDIDO_RECHAZADO_FALTA_PAGO','sin_repartidores'/g, "'PEDIDO_RECHAZADO_FALTA_PAGO','sin_repartidores','repartidor_encontrado_espera'");

fs.writeFileSync('src/pages/AdminCRM.jsx', content);
