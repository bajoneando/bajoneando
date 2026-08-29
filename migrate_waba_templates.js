import fs from 'fs';

const OLD_WABA_ID = '887088531142908';
const NEW_WABA_ID = '1940461113294585';
const API_VERSION = 'v21.0';

// Puedes pasar el token como argumento o ponerlo aquí directamente
const ACCESS_TOKEN = process.argv[2] || 'TU_ACCESS_TOKEN_AQUI';

if (ACCESS_TOKEN === 'TU_ACCESS_TOKEN_AQUI') {
  console.error('Por favor, proporciona un token de acceso válido como argumento o edita el script.');
  console.log('Uso: node migrate_waba_templates.js <TU_ACCESS_TOKEN>');
  process.exit(1);
}

async function migrateTemplates() {
  try {
    console.log(`Obteniendo plantillas de la WABA antigua (${OLD_WABA_ID})...`);
    
    // 1. Obtener las plantillas
    const getUrl = `https://graph.facebook.com/${API_VERSION}/${OLD_WABA_ID}/message_templates?limit=1000`;
    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!getResponse.ok) {
      const errorData = await getResponse.json();
      throw new Error(`Error al obtener plantillas: ${JSON.stringify(errorData)}`);
    }

    const getData = await getResponse.json();
    const templates = getData.data || [];
    
    console.log(`Se encontraron ${templates.length} plantillas. Iniciando migración a la WABA nueva (${NEW_WABA_ID})...`);

    // 2. Crear las plantillas en la WABA nueva
    let successCount = 0;
    let errorCount = 0;

    for (const template of templates) {
      // Limpiamos campos de solo lectura o irrelevantes para la creación
      const payload = {
        name: template.name,
        category: template.category,
        language: template.language,
        components: template.components
      };

      console.log(`Creando plantilla: ${template.name} (${template.language})...`);

      const postUrl = `https://graph.facebook.com/${API_VERSION}/${NEW_WABA_ID}/message_templates`;
      const postResponse = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const postData = await postResponse.json();

      if (postResponse.ok) {
        console.log(`✅ Plantilla '${template.name}' creada con éxito. ID: ${postData.id}`);
        successCount++;
      } else {
        console.error(`❌ Error al crear plantilla '${template.name}':`, postData.error?.message || JSON.stringify(postData));
        errorCount++;
      }

      // Pequeña pausa para no saturar el API (Rate limits)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n--- Resumen de Migración ---');
    console.log(`Total procesadas: ${templates.length}`);
    console.log(`Exitosas: ${successCount}`);
    console.log(`Errores: ${errorCount}`);

  } catch (error) {
    console.error('Error durante la migración:', error.message);
  }
}

migrateTemplates();
