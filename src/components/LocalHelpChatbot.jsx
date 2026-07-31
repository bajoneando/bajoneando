import React, { useState, useEffect, useRef } from 'react';
import './HelpChatbot.css';
import toast from 'react-hot-toast';

const ASSISTANT_IMAGE = "https://i.postimg.cc/RV8VGysv/wepi-(10).png";
const WHATSAPP_NUMBER = "5493756543610";

const LocalHelpChatbot = ({ orders = [], onRefreshOrders, onReavisarRepartidor, onPrintTicket }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "¡Hola! 👋 Soy tu asistente de soporte para locales Wepi. ¿Qué problema necesitás resolver?", isBot: true }
  ]);
  const [showButtons, setShowButtons] = useState(true);
  const [activeFlow, setActiveFlow] = useState(null); // 'repartidor', 'print'
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, activeFlow]);

  // Pedidos listos con envío para reavisar repartidor
  const readyDeliveryOrders = (orders || []).filter(o => 
    (o.estadoActual === 'Listo' || o.estadoActual === 'Buscando Repartidor') &&
    (String(o.tipoEntrega).toLowerCase().includes('env') || o.tipoEntrega === 'Con Envío')
  );

  // Pedidos recientes para reimpresión de ticket
  const recentOrdersForPrint = (orders || []).filter(o => 
    !['Rechazado', 'Cancelado'].includes(o.estadoActual)
  ).slice(0, 5);

  const handleOptionClick = (option) => {
    const userMsg = { id: Date.now(), text: option.label, isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setShowButtons(false);
    setActiveFlow(null);

    setTimeout(() => {
      let botResponse = "";

      switch (option.id) {
        case 'no_entro_pedido':
          botResponse = "Entendido. Estoy refrescando tu panel de pedidos en tiempo real...";
          if (onRefreshOrders) {
            onRefreshOrders();
            toast.success("🔄 Panel de pedidos refrescado", { icon: "🔄" });
          }
          setTimeout(() => {
            const botMsg2 = {
              id: Date.now() + 2,
              text: "¡Listo! Panel actualizado. Si el cliente realizó el pedido recientemente, ya debería figurar en la pestaña 'Pendientes'.",
              isBot: true
            };
            setMessages(prev => [...prev, botMsg2]);
            setShowButtons(true);
          }, 1200);
          break;

        case 'no_llego_repartidor':
          if (readyDeliveryOrders.length === 0) {
            botResponse = "No tenés pedidos en estado 'Listo' con envío pendientes de retiro en este momento. Si creés que hay una demora con una orden en camino, escribinos por WhatsApp.";
            setShowButtons(true);
          } else {
            botResponse = "Por favor, seleccioná cuál de tus pedidos listos necesita que reavisemos al repartidor:";
            setActiveFlow('repartidor');
          }
          break;

        case 'no_imprimio_ticket':
          botResponse = "¿Deseás reiniciar la cola de impresión de Electron o imprimir el ticket de un pedido específico?";
          setActiveFlow('print');
          break;

        case 'soporte':
          botResponse = "Para resolver cualquier otro inconveniente técnico o consulta, podés comunicarte directamente con nuestro equipo de soporte.";
          setTimeout(() => {
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20necesito%20asistencia%20en%20mi%20panel%20de%20locales%20Wepi.`, '_blank');
          }, 1500);
          setShowButtons(true);
          break;

        default:
          botResponse = "Un representante de soporte Wepi te asistirá a la brevedad.";
          setShowButtons(true);
      }

      const botMsg = { id: Date.now() + 1, text: botResponse, isBot: true };
      setMessages(prev => [...prev, botMsg]);
    }, 800);
  };

  const handleSelectOrderReavisar = (order) => {
    const userMsg = { id: Date.now(), text: `Reavisar Pedido #${order.idPedido} (${order.nombreCliente})`, isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setActiveFlow(null);

    setTimeout(() => {
      if (onReavisarRepartidor) {
        onReavisarRepartidor(order);
      }
      const botMsg = {
        id: Date.now() + 1,
        text: `¡Excelente! Se re-envió una alerta prioritaria al repartidor para el pedido #${order.idPedido}.`,
        isBot: true
      };
      setMessages(prev => [...prev, botMsg]);
      setShowButtons(true);
    }, 1000);
  };

  const handleSelectOrderPrint = (order) => {
    const userMsg = { id: Date.now(), text: `Imprimir Ticket Pedido #${order.idPedido}`, isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setActiveFlow(null);

    setTimeout(() => {
      if (onPrintTicket) {
        onPrintTicket(order);
      }
      const botMsg = {
        id: Date.now() + 1,
        text: `Enviando el ticket del pedido #${order.idPedido} a la impresora...`,
        isBot: true
      };
      setMessages(prev => [...prev, botMsg]);
      setShowButtons(true);
    }, 800);
  };

  const handleResetPrintQueue = () => {
    const userMsg = { id: Date.now(), text: "🔄 Reiniciar cola de impresión Electron", isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setActiveFlow(null);

    setTimeout(() => {
      if (window.electronAPI && window.electronAPI.refreshPrintQueue) {
        window.electronAPI.refreshPrintQueue();
      }
      toast.success("Cola de impresión reiniciada", { icon: "🖨️" });
      const botMsg = {
        id: Date.now() + 1,
        text: "Se ha reiniciado la cola de impresión. Si usás la app de escritorio de Wepi (Electron), los tickets pendientes se reenviarán a tu impresora.",
        isBot: true
      };
      setMessages(prev => [...prev, botMsg]);
      setShowButtons(true);
    }, 800);
  };

  const mainOptions = [
    { id: 'no_entro_pedido', label: '📥 No entró un pedido' },
    { id: 'no_llego_repartidor', label: '🛵 No llegó el repartidor' },
    { id: 'no_imprimio_ticket', label: '🖨️ No se imprimió ticket' },
    { id: 'soporte', label: '💬 Soporte por WhatsApp' },
  ];

  return (
    <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
      {!isOpen && (
        <button className="chatbot-toggle" onClick={() => setIsOpen(true)}>
          <img src={ASSISTANT_IMAGE} alt="Ayuda" />
          <span className="toggle-badge">Ayuda</span>
        </button>
      )}

      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="assistant-info">
              <img src={ASSISTANT_IMAGE} alt="Assistant" />
              <div>
                <h4>Soporte Wepi Locales</h4>
                <span>En línea</span>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div className="chatbot-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.isBot ? 'bot' : 'user'}`}>
                {msg.isBot && <img src={ASSISTANT_IMAGE} className="msg-avatar" alt="bot" />}
                <div className="message-text">{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <button className="toggle-options-btn" onClick={() => { setShowButtons(!showButtons); setActiveFlow(null); }}>
            {showButtons ? '🔽 Ocultar opciones' : '🔼 Mostrar opciones de ayuda'}
          </button>

          {showButtons && !activeFlow && (
            <div className="chatbot-options">
              {mainOptions.map(opt => (
                <button key={opt.id} onClick={() => handleOptionClick(opt)}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {activeFlow === 'repartidor' && (
            <div className="chatbot-options" style={{ background: '#fff1f2', borderTop: '1px solid #fecdd3' }}>
              <span style={{ fontSize: '0.78rem', color: '#9f1239', fontWeight: 600, width: '100%', marginBottom: 4 }}>
                Seleccioná el pedido para alertar al repartidor:
              </span>
              {readyDeliveryOrders.map(o => (
                <button 
                  key={o.idPedidoLocal} 
                  style={{ background: '#fff', borderColor: '#f43f5e', color: '#be123c', fontSize: '0.78rem' }}
                  onClick={() => handleSelectOrderReavisar(o)}
                >
                  🛵 #${o.idPedido} - {o.nombreCliente} (${o.totalLocal})
                </button>
              ))}
              <button 
                style={{ background: '#e2e8f0', borderColor: '#cbd5e1', color: '#475569', fontSize: '0.75rem' }} 
                onClick={() => { setActiveFlow(null); setShowButtons(true); }}
              >
                Volver
              </button>
            </div>
          )}

          {activeFlow === 'print' && (
            <div className="chatbot-options" style={{ background: '#f0f9ff', borderTop: '1px solid #bae6fd' }}>
              <span style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 600, width: '100%', marginBottom: 4 }}>
                Opciones de Impresión:
              </span>
              <button 
                style={{ background: '#0284c7', borderColor: '#0284c7', color: '#fff', fontWeight: 600 }} 
                onClick={handleResetPrintQueue}
              >
                🔄 Reiniciar cola Electron
              </button>
              {recentOrdersForPrint.map(o => (
                <button 
                  key={o.idPedidoLocal} 
                  style={{ background: '#fff', borderColor: '#0284c7', color: '#0369a1', fontSize: '0.78rem' }}
                  onClick={() => handleSelectOrderPrint(o)}
                >
                  🖨️ Ticket #${o.idPedido} ({o.nombreCliente})
                </button>
              ))}
              <button 
                style={{ background: '#e2e8f0', borderColor: '#cbd5e1', color: '#475569', fontSize: '0.75rem' }} 
                onClick={() => { setActiveFlow(null); setShowButtons(true); }}
              >
                Volver
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocalHelpChatbot;
