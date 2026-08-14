import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-red-500/30 selection:text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate('/')}
          className="mb-8 flex items-center text-red-500 hover:text-red-400 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver al inicio
        </button>

        <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
          Políticas de Privacidad de Wepi
        </h1>
        
        <div className="space-y-6 text-gray-300 leading-relaxed">
          <p>
            <strong>Última actualización:</strong> {new Date().toLocaleDateString('es-AR')}
          </p>

          <section className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
            <h2 className="text-2xl font-semibold mb-4 text-white">1. Información que recopilamos</h2>
            <p className="mb-2">Al utilizar Wepi, recopilamos los siguientes tipos de información:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Datos de la cuenta:</strong> Nombre, dirección de correo electrónico y número de teléfono al registrarte.</li>
              <li><strong>Datos de ubicación:</strong> Tu dirección exacta o coordenadas GPS para poder entregar tus pedidos de manera precisa.</li>
              <li><strong>Información del dispositivo:</strong> Identificadores de dispositivo (tokens) para poder enviarte notificaciones push sobre el estado de tu pedido.</li>
              <li><strong>Historial de uso:</strong> Historial de pedidos realizados, locales favoritos y calificaciones.</li>
            </ul>
          </section>

          <section className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
            <h2 className="text-2xl font-semibold mb-4 text-white">2. Cómo usamos tu información</h2>
            <p className="mb-2">Utilizamos la información recopilada exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Procesar y entregar tus pedidos de comida o productos.</li>
              <li>Comunicarnos contigo mediante notificaciones push o WhatsApp respecto al estado de tu entrega.</li>
              <li>Mejorar nuestra aplicación, entender hábitos de consumo y personalizar tu experiencia en la plataforma.</li>
              <li>Compartir tu nombre y dirección únicamente con el local y el repartidor asignado a tu orden.</li>
            </ul>
          </section>

          <section className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
            <h2 className="text-2xl font-semibold mb-4 text-white">3. Compartir información</h2>
            <p>
              Wepi no vende, alquila ni comercializa tu información personal a terceros. Únicamente compartimos la información estrictamente necesaria (tu nombre, dirección y detalle del pedido) con los locales adheridos y los repartidores para poder cumplir con el servicio solicitado.
            </p>
          </section>

          <section className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
            <h2 className="text-2xl font-semibold mb-4 text-white">4. Tus derechos</h2>
            <p>
              Puedes solicitar en cualquier momento la eliminación de tu cuenta y de todos tus datos personales asociados enviándonos un mensaje o utilizando la opción correspondiente dentro de la aplicación.
            </p>
          </section>

          <section className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
            <h2 className="text-2xl font-semibold mb-4 text-white">5. Contacto</h2>
            <p>
              Si tienes dudas o consultas sobre estas Políticas de Privacidad, puedes contactarnos a través de nuestros canales oficiales o en la sección de soporte de la aplicación.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
