# Wepi WhatsApp Server (Baileys)

Servidor backend en Node.js que gestiona las conexiones de WhatsApp Web de los comercios a través de códigos QR, procesa sus mensajes en tiempo real y los conecta con la base de datos de Supabase.

## 🚀 Requisitos previos

Este servidor reutilizará las credenciales de Supabase que ya tienes configuradas en el archivo `.env` del directorio principal del proyecto. Asegúrate de que ese archivo `.env` exista y tenga las claves correctas.

## 📦 Instalación

1. Abre una terminal en esta carpeta (`whatsapp-server/`).
2. Ejecuta el comando para instalar las dependencias:
   ```bash
   npm install
   ```

## 🛠️ Ejecución en Desarrollo

Para arrancar el servidor en modo de desarrollo con recarga automática cuando hagas cambios:

```bash
npm run dev
```

El servidor se iniciará en el puerto `3001` y verás la consola indicando:
`🔌 Servidor de WhatsApp Wepi corriendo en puerto 3001`

## 🔗 Endpoints disponibles

- `GET http://localhost:3001/api/status?localId=[LOCAL_ID]`: Consulta el estado actual de la sesión.
- `POST http://localhost:3001/api/connect`: Inicia la sesión para un local (genera el QR en el estado si es necesario).
- `POST http://localhost:3001/api/disconnect`: Cierra la sesión y borra las credenciales locales de ese comercio.

## 💾 Persistencia de Sesión

Las credenciales de inicio de sesión de WhatsApp se guardan en la carpeta `auth_info/[localId]`. Esto significa que si detienes o reinicias el servidor, **los comercios seguirán conectados automáticamente** la próxima vez que inicie, sin necesidad de volver a escanear el código QR.
