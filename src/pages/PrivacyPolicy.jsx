import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Landing.css';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="landing-corporate flex flex-col min-h-screen">
      {/* 1. Header Simplificado */}
      <header className="navbar-red">
        <div className="navbar-container flex justify-between items-center w-full">
          <Link to="/" className="navbar-brand">
            <img
              src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png"
              alt="Wepi Logo"
              className="navbar-logo"
            />
          </Link>
          <button 
            onClick={() => navigate('/')}
            className="text-white hover:text-red-200 transition-colors text-sm font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full mt-28 mb-16 bg-neutral-900 rounded-2xl shadow-xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
          Políticas de Privacidad
        </h1>
        
        <div className="space-y-4 text-gray-300 leading-relaxed text-xs md:text-sm">
          <p>
            <strong>Última actualización:</strong> {new Date().toLocaleDateString('es-AR')}
          </p>

          <section className="bg-neutral-800/30 p-6 md:p-8 rounded-xl border border-neutral-700/50">
            <h2 className="text-base md:text-lg font-semibold mb-4 text-white">1. Información que recopilamos</h2>
            <p className="mb-4">Al utilizar Wepi, recopilamos los siguientes tipos de información:</p>
            <ul className="list-disc pl-5 space-y-3">
              <li><strong>Datos de la cuenta:</strong> Nombre, dirección de correo electrónico y número de teléfono al registrarte.</li>
              <li><strong>Datos de ubicación:</strong> Tu dirección exacta o coordenadas GPS para poder entregar tus pedidos de manera precisa.</li>
              <li><strong>Información del dispositivo:</strong> Identificadores de dispositivo (tokens) para poder enviarte notificaciones push sobre el estado de tu pedido.</li>
              <li><strong>Historial de uso:</strong> Historial de pedidos realizados, locales favoritos y calificaciones.</li>
            </ul>
          </section>

          <section className="bg-neutral-800/30 p-6 md:p-8 rounded-xl border border-neutral-700/50">
            <h2 className="text-base md:text-lg font-semibold mb-4 text-white">2. Cómo usamos tu información</h2>
            <p className="mb-4">Utilizamos la información recopilada exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-3">
              <li>Procesar y entregar tus pedidos de comida o productos.</li>
              <li>Comunicarnos contigo mediante notificaciones push o WhatsApp respecto al estado de tu entrega.</li>
              <li>Mejorar nuestra aplicación, entender hábitos de consumo y personalizar tu experiencia en la plataforma.</li>
              <li>Compartir tu nombre y dirección únicamente con el local y el repartidor asignado a tu orden.</li>
            </ul>
          </section>

          <section className="bg-neutral-800/30 p-6 md:p-8 rounded-xl border border-neutral-700/50">
            <h2 className="text-base md:text-lg font-semibold mb-4 text-white">3. Compartir información</h2>
            <p className="leading-loose">
              Wepi no vende, alquila ni comercializa tu información personal a terceros. Únicamente compartimos la información estrictamente necesaria (tu nombre, dirección y detalle del pedido) con los locales adheridos y los repartidores para poder cumplir con el servicio solicitado.
            </p>
          </section>

          <section className="bg-neutral-800/30 p-6 md:p-8 rounded-xl border border-neutral-700/50">
            <h2 className="text-base md:text-lg font-semibold mb-4 text-white">4. Tus derechos</h2>
            <p className="leading-loose">
              Puedes solicitar en cualquier momento la eliminación de tu cuenta y de todos tus datos personales asociados enviándonos un mensaje o utilizando la opción correspondiente dentro de la aplicación.
            </p>
          </section>

          <section className="bg-neutral-800/30 p-6 md:p-8 rounded-xl border border-neutral-700/50">
            <h2 className="text-base md:text-lg font-semibold mb-4 text-white">5. Contacto</h2>
            <p className="leading-loose">
              Si tienes dudas o consultas sobre estas Políticas de Privacidad, puedes contactarnos a través de nuestros canales oficiales o en la sección de soporte de la aplicación.
            </p>
          </section>
        </div>
      </main>

      {/* 7. Footer Simplificado */}
      <footer className="corporate-footer mt-auto">
        <div className="footer-container justify-center text-center flex-col items-center py-8">
          <img
            src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png"
            alt="Wepi Logo"
            className="footer-logo mb-4"
          />
          <p className="text-neutral-300 text-sm max-w-md mx-auto font-medium">
            © {new Date().getFullYear()} Wepi — Políticas de Privacidad
          </p>
        </div>
      </footer>
    </div>
  );
}
