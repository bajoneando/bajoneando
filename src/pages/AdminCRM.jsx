import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as api from '../services/api';
import './AdminCRM.css';

const DEFAULT_CRM_AUTOMATION_MATRIX = [
    {
        id: 'registrado_sin_pedidos',
        evento: '👤 Registrado',
        estado: 'REGISTRADO',
        trigger_type: 'evento_sistema',
        trigger_label: 'Sin pedidos',
        trigger_config: { evento_key: 'USUARIO_REGISTRADO', dias: 0 },
        comunicacion: 'Adquisición',
        enabled: true,
        canales: ['whatsapp', 'push', 'email'],
        configs: {
            whatsapp: { enabled: true, template_name: 'adquisicion_bienvenida' },
            push: { enabled: true, title: '¡Bienvenido a Wepi!', body: 'Descubre los mejores locales cerca tuyo.', url: '/pedir' },
            email: { enabled: true, subject: '¡Bienvenido a Wepi! 🍔', body: 'Hola [Nombre], gracias por registrarte...', url: 'https://wepi.com.ar/pedir', logo_url: '' }
        }
    },
    {
        id: 'visito_no_compro',
        evento: '👀 Visitó',
        estado: 'VISITANTE',
        trigger_type: 'evento_sistema',
        trigger_label: 'No compró',
        trigger_config: { evento_key: 'VISITA_SIN_COMPRA' },
        comunicacion: 'Activación',
        enabled: true,
        canales: ['push', 'whatsapp', 'email'],
        configs: {
            push: { enabled: true, title: '¿Tienes hambre?', body: 'Encuentra promociones exclusivas hoy.', url: '/pedir' },
            whatsapp: { enabled: true, template_name: 'activacion_visita' },
            email: { enabled: true, subject: 'Tus tiendas favoritas te esperan', body: 'Hola [Nombre]...', url: 'https://wepi.com.ar', logo_url: '' }
        }
    },
    {
        id: 'carrito_abandono',
        evento: '🛒 Carrito Abandonado',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: 'Abandonó',
        trigger_config: { evento_key: 'CARRITO_ABANDONADO' },
        comunicacion: 'Recuperación',
        enabled: true,
        canales: ['whatsapp', 'push', 'none'],
        configs: {
            whatsapp: { enabled: true, template_name: 'recuperacion_1' },
            push: { enabled: true, title: '¡Olvidaste productos en tu carrito!', body: 'Concluye tu pedido en 1 solo clic.', url: '/checkout' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'pedido_no_pago',
        evento: '💳 Pedido creado',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: 'No pagó',
        trigger_config: { evento_key: 'PEDIDO_NO_PAGADO' },
        comunicacion: 'Recuperación de pago',
        enabled: true,
        canales: ['whatsapp', 'push', 'none'],
        configs: {
            whatsapp: { enabled: true, template_name: 'pago_pendiente_alerta' },
            push: { enabled: true, title: 'Pago pendiente', body: 'Tu pedido aguarda por la confirmación de pago.', url: '/mis-pedidos' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'pedido_rechazado_falta_pago',
        evento: '❌ Pedido Rechazado por Falta de Pago',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: 'Pago rechazado / fallido',
        trigger_config: { evento_key: 'PEDIDO_RECHAZADO_FALTA_PAGO' },
        comunicacion: 'Alerta de pago fallido',
        enabled: true,
        canales: ['whatsapp', 'push', 'none'],
        configs: {
            whatsapp: { enabled: true, template_name: 'pago_rechazado_alerta' },
            push: { enabled: true, title: 'Pago Rechazado ❌', body: 'Tu pago no pudo ser procesado. Reintenta con otro medio de pago.', url: '/checkout' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'esperando_repartidor',
        evento: '🛵 Esperando repartidor',
        estado: 'TODOS',
        trigger_type: 'minutos_post_entrega',
        trigger_label: 'Demora (15 min)',
        trigger_config: { minutos: 15 },
        comunicacion: 'Seguimiento',
        enabled: true,
        canales: ['whatsapp', 'push', 'none'],
        configs: {
            whatsapp: { enabled: true, template_name: 'seguimiento_demora_repartidor' },
            push: { enabled: true, title: 'Buscando repartidor...', body: 'Seguimos asignando tu pedido.', url: '/mis-pedidos' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'sin_repartidores',
        evento: '🛵 1. Aviso Sin Repartidores (Fase 2)',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: 'Sin repartidores disponibles',
        trigger_config: { evento_key: 'sin_repartidores' },
        comunicacion: 'Rescate por demanda',
        enabled: true,
        canales: ['whatsapp', 'push', 'none'],
        configs: {
            whatsapp: { enabled: true, template_name: 'sin_repartidores' },
            push: { enabled: true, title: 'Buscando repartidor... 🛵', body: 'No encontramos repartidores cercanos. Guardamos tu pedido para reintentar en 1 clic.', url: '/checkout' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'pedido_rechazado_sin_repartidor_2',
        evento: '🛵 2. Refuerzo 5 min Sin Repartidor (Sin Repetir Pedido)',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: '5 min sin repetir pedido tras sin_repartidores',
        trigger_config: { evento_key: 'PEDIDO_RECHAZADO_SIN_REPARTIDOR_2' },
        comunicacion: 'Refuerzo de rescate',
        enabled: true,
        canales: ['whatsapp', 'push', 'none'],
        configs: {
            whatsapp: { enabled: true, template_name: 'sin_repartidores_refuerzo_5m' },
            push: { enabled: true, title: '🛵 ¿Reintentamos tu pedido?', body: 'Han pasado 5 min y tu carrito sigue guardado. Reintenta tu pedido en 1 solo clic.', url: '/checkout' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'pedido_aceptado',
        evento: '👨‍🍳 Pedido Aceptado',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: 'En preparación',
        trigger_config: { evento_key: 'PEDIDO_ACEPTADO' },
        comunicacion: 'Confirmación',
        enabled: true,
        canales: ['push', 'whatsapp', 'none'],
        configs: {
            push: { enabled: true, title: '¡Tu pedido fue aceptado! 🍳', body: 'El comercio ya está preparando tu comida.', url: '/mis-pedidos' },
            whatsapp: { enabled: true, template_name: 'pedido_en_preparacion' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'pedido_retirado',
        evento: '📦 Pedido Retirado',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: 'Retirado por repartidor',
        trigger_config: { evento_key: 'PEDIDO_RETIRADO' },
        comunicacion: 'En camino',
        enabled: true,
        canales: ['push', 'whatsapp', 'none'],
        configs: {
            push: { enabled: true, title: '¡Pedido retirado! 🛵', body: 'El repartidor ya lleva tu pedido en camino.', url: '/mis-pedidos' },
            whatsapp: { enabled: true, template_name: 'pedido_retirado_camino' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'repartidor_cerca',
        evento: '📍 Repartidor cerca',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: 'A menos de 500m',
        trigger_config: { evento_key: 'REPARTIDOR_CERCA' },
        comunicacion: 'Aviso de llegada',
        enabled: true,
        canales: ['push', 'whatsapp', 'none'],
        configs: {
            push: { enabled: true, title: '🛵 ¡Tu repartidor está cerca!', body: 'Está a menos de 500 metros de tu domicilio. Prepárate para recibirlo.', url: '/mis-pedidos' },
            whatsapp: { enabled: true, template_name: 'repartidor_cerca_alerta' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'en_camino',
        evento: '🚴 En camino',
        estado: 'TODOS',
        trigger_type: 'evento_sistema',
        trigger_label: 'Repartidor asignado',
        trigger_config: { evento_key: 'REPARTIDOR_ASIGNADO' },
        comunicacion: 'Seguimiento',
        enabled: true,
        canales: ['push', 'whatsapp', 'none'],
        configs: {
            push: { enabled: true, title: '¡Tu pedido va en camino! 🛵', body: 'El repartidor está cerca de tu ubicación.', url: '/mis-pedidos' },
            whatsapp: { enabled: true, template_name: 'repartidor_en_camino' },
            email: { enabled: false, subject: '', body: '', url: '', logo_url: '' }
        }
    },
    {
        id: 'pedido_entregado',
        evento: '✅ Pedido entregado',
        estado: 'TODOS',
        trigger_type: 'minutos_post_entrega',
        trigger_label: '30 min tras entrega',
        trigger_config: { minutos: 30 },
        comunicacion: 'Satisfacción',
        enabled: true,
        canales: ['whatsapp', 'push', 'email'],
        configs: {
            whatsapp: { enabled: true, template_name: 'encuesta_satisfaccion' },
            push: { enabled: true, title: '¿Cómo estuvo tu pedido?', body: 'Danos tu calificación para seguir mejorando.', url: '/mis-pedidos' },
            email: { enabled: true, subject: '¿Qué tal tu experiencia con Wepi?', body: 'Gracias por pedir...', url: 'https://wepi.com.ar', logo_url: '' }
        }
    },
    {
        id: 'cliente_satisfecho',
        evento: '⭐ Cliente satisfecho',
        estado: 'CLIENTE_ACTIVO',
        trigger_type: 'dias_inactividad',
        trigger_label: '1 día tras compra',
        trigger_config: { dias: 1 },
        comunicacion: 'Fidelización',
        enabled: true,
        canales: ['whatsapp', 'push', 'email'],
        configs: {
            whatsapp: { enabled: true, template_name: 'fidelizacion_cupon_descuento' },
            push: { enabled: true, title: '¡Regalo para tu próximo pedido!', body: 'Tienes un cupón activo.', url: '/pedir' },
            email: { enabled: true, subject: 'Un regalo especial para ti 🎁', body: 'Aprovecha este beneficio...', url: 'https://wepi.com.ar', logo_url: '' }
        }
    },
    {
        id: 'recompra_7dias',
        evento: '🔁 Recordatorio 7 días',
        estado: 'CLIENTE_ACTIVO',
        trigger_type: 'dias_inactividad',
        trigger_label: '7 días sin pedir',
        trigger_config: { dias: 7 },
        comunicacion: 'Recompra',
        enabled: true,
        canales: ['push', 'whatsapp', 'email'],
        configs: {
            push: { enabled: true, title: '¡Te extrañamos!', body: 'Hace una semana que no pides. ¿Qué se te antoja hoy?', url: '/pedir' },
            whatsapp: { enabled: true, template_name: 'recompra_7dias' },
            email: { enabled: true, subject: 'Es hora de darte un gusto 🍔', body: 'Descubre los menúes de hoy...', url: 'https://wepi.com.ar', logo_url: '' }
        }
    },
    {
        id: 'recompra_14dias',
        evento: '🔁 Recordatorio 14 días',
        estado: 'CLIENTE_ACTIVO',
        trigger_type: 'dias_inactividad',
        trigger_label: '14 días sin pedir',
        trigger_config: { dias: 14 },
        comunicacion: 'Recompra',
        enabled: true,
        canales: ['push', 'whatsapp', 'email'],
        configs: {
            push: { enabled: true, title: '¿Sin ganas de cocinar?', body: 'Tu comida favorita lista para ser entregada.', url: '/pedir' },
            whatsapp: { enabled: true, template_name: 'recompra_14dias' },
            email: { enabled: true, subject: 'Tu próximo pedido tiene descuento 🚀', body: 'Hola...', url: 'https://wepi.com.ar', logo_url: '' }
        }
    },
    {
        id: 'inactivo_30dias',
        evento: '😴 Inactivo 30 días',
        estado: 'DORMIDO',
        trigger_type: 'dias_inactividad',
        trigger_label: '30 días sin pedir',
        trigger_config: { dias: 30 },
        comunicacion: 'Reactivación',
        enabled: true,
        canales: ['whatsapp', 'push', 'email'],
        configs: {
            whatsapp: { enabled: true, template_name: 'reactivacion_30dias' },
            push: { enabled: true, title: '¡Regresa a Wepi!', body: 'Reclama tu cupón de reactivación antes de que venza.', url: '/pedir' },
            email: { enabled: true, subject: 'Te echamos de menos en Wepi 💛', body: 'Te extrañamos...', url: 'https://wepi.com.ar', logo_url: '' }
        }
    },
    {
        id: 'inactivo_60dias',
        evento: '💤 Inactivo 60 días',
        estado: 'DORMIDO',
        trigger_type: 'dias_inactividad',
        trigger_label: '60 días sin pedir',
        trigger_config: { dias: 60 },
        comunicacion: 'Reactivación fuerte',
        enabled: true,
        canales: ['whatsapp', 'push', 'email'],
        configs: {
            whatsapp: { enabled: true, template_name: 'reactivacion_fuerte_60dias' },
            push: { enabled: true, title: 'Descuento especial del 25%', body: 'Vuelve hoy y aprovecha esta súper oferta.', url: '/pedir' },
            email: { enabled: true, subject: '¡Último llamado! Vuelve con 25% OFF', body: 'Te extrañamos...', url: 'https://wepi.com.ar', logo_url: '' }
        }
    },
    {
        id: 'cliente_frecuente',
        evento: '❤️ Cliente Frecuente',
        estado: 'CLIENTE_FRECUENTE',
        trigger_type: 'frecuencia_pedidos',
        trigger_label: '3 o 5 pedidos',
        trigger_config: { pedidos_count: 5 },
        comunicacion: 'Fidelización',
        enabled: true,
        canales: ['push', 'whatsapp', 'email'],
        configs: {
            push: { enabled: true, title: '¡Gracias por ser un cliente fiel!', body: 'Suma puntos extra en tu saldo de Wallet.', url: '/pedir' },
            whatsapp: { enabled: true, template_name: 'fidelizacion_frecuente' },
            email: { enabled: true, subject: 'Beneficios exclusivos por tu fidelidad 🌟', body: 'Hola...', url: 'https://wepi.com.ar', logo_url: '' }
        }
    },
    {
        id: 'cliente_vip',
        evento: '🏆 Cliente VIP',
        estado: 'VIP',
        trigger_type: 'frecuencia_pedidos',
        trigger_label: 'Alta frecuencia (VIP)',
        trigger_config: { pedidos_count: 10 },
        comunicacion: 'Exclusividad',
        enabled: true,
        canales: ['whatsapp', 'email', 'push'],
        configs: {
            whatsapp: { enabled: true, template_name: 'vip_exclusivo' },
            email: { enabled: true, subject: '👑 Acceso VIP Exclusivo a Wepi Premier', body: 'Gracias por ser cliente VIP...', url: 'https://wepi.com.ar', logo_url: '' },
            push: { enabled: true, title: '👑 Eres Cliente VIP', body: 'Disfruta de envíos gratis y atención prioritaria.', url: '/pedir' }
        }
    }
];

const DEFAULT_WEPI_HABITS_CONFIG = {
    global_settings: {
        max_weekly_per_user: 3,
        max_weekly_whatsapp: 1,
        prioritize_push_app: true,
        wa_invite_app_template: 'instala_app',
        wa_invite_app_enabled: true,
        predictive_habits_enabled: true,
        habit_threshold_orders: 3
    },
    moments: [
        {
            id: 'desayuno',
            nombre: '☀️ Desayuno',
            hora: '08:30',
            enabled: true,
            canales: ['push', 'whatsapp', 'email'],
            configs: {
                push: { enabled: true, title: '☀️ ¿Qué vas a desayunar hoy?', body: 'Empieza tu mañana con el mejor café y panadería en Wepi.', url: '/pedir' },
                whatsapp: { enabled: true, template_name: 'desayuno_sugerencia' },
                email: { enabled: true, subject: 'Empieza la mañana con un gran desayuno ☕', body: 'Hola [Nombre]...', url: 'https://wepi.com.ar/pedir', logo_url: '' }
            }
        },
        {
            id: 'almuerzo',
            nombre: '🍔 Almuerzo',
            hora: '12:00',
            enabled: true,
            canales: ['push', 'whatsapp', 'email'],
            configs: {
                push: { enabled: true, title: '🍔 ¿Qué vas a almorzar hoy?', body: 'Tu comida favorita lista para ser entregada.', url: '/pedir' },
                whatsapp: { enabled: true, template_name: 'almuerzo_sugerencia' },
                email: { enabled: true, subject: '¿Con hambre? Descubre los menúes de hoy 🍽️', body: 'Hola [Nombre]...', url: 'https://wepi.com.ar/pedir', logo_url: '' }
            }
        },
        {
            id: 'postre',
            nombre: '🍦 Postre',
            hora: '15:30',
            enabled: true,
            canales: ['push', 'whatsapp', 'email'],
            configs: {
                push: { enabled: true, title: '🍦 ¿Y de postre? 😋', body: 'Helados, tortas y dulzuras a un clic.', url: '/pedir' },
                whatsapp: { enabled: true, template_name: 'postre_sugerencia' },
                email: { enabled: true, subject: 'Un gusto dulce para la tarde 🍰', body: 'Hola [Nombre]...', url: 'https://wepi.com.ar/pedir', logo_url: '' }
            }
        },
        {
            id: 'merienda',
            nombre: '☕ Merienda',
            hora: '17:00',
            enabled: true,
            canales: ['push', 'whatsapp', 'email'],
            configs: {
                push: { enabled: true, title: '☕ ¿Pinta merienda?', body: 'Acompaña tu tarde con tus bocados favoritos.', url: '/pedir' },
                whatsapp: { enabled: true, template_name: 'merienda_sugerencia' },
                email: { enabled: true, subject: 'La hora de la merienda en Wepi 🥐', body: 'Hola [Nombre]...', url: 'https://wepi.com.ar/pedir', logo_url: '' }
            }
        },
        {
            id: 'cena',
            nombre: '🍔 Cena',
            hora: '20:30',
            enabled: true,
            canales: ['push', 'whatsapp', 'email'],
            configs: {
                push: { enabled: true, title: '🍔 ¿Qué cenamos hoy?', body: 'Relájate y pide la cena sin salir de casa.', url: '/pedir' },
                whatsapp: { enabled: true, template_name: 'cena_sugerencia' },
                email: { enabled: true, subject: 'Tu cena lista en la puerta 🍕', body: 'Hola [Nombre]...', url: 'https://wepi.com.ar/pedir', logo_url: '' }
            }
        },
        {
            id: 'antojo',
            nombre: '🌙 Antojo Nocturno',
            hora: '23:00',
            enabled: true,
            canales: ['push', 'whatsapp', 'email'],
            configs: {
                push: { enabled: true, title: '🌙 ¿Se te antojó algo? 👀', body: 'Locales nocturnos abiertos cerca tuyo.', url: '/pedir' },
                whatsapp: { enabled: true, template_name: 'antojo_nocturno' },
                email: { enabled: true, subject: 'Antojos de medianoche 🌙', body: 'Hola [Nombre]...', url: 'https://wepi.com.ar/pedir', logo_url: '' }
            }
        }
    ]
};

const AdminCRM = () => {
    // Sub-navigation tabs
    const [activeTab, setActiveTab] = useState('dashboard');
    const [specialCampaigns, setSpecialCampaigns] = useState([]);
    const [showSpecialCampaignForm, setShowSpecialCampaignForm] = useState(false);
    const [specialCampaignForm, setSpecialCampaignForm] = useState({ id: null, nombre: '', canales: ['whatsapp', 'push', 'email'], configs: { whatsapp: { enabled: true, template_name: '' }, push: { enabled: true, title: '', body: '', url: '' }, email: { enabled: true, subject: '', body: '' } }, trigger_time: '' });
    const [savingSpecialCampaign, setSavingSpecialCampaign] = useState(false);
    
    // Core data states
    const [usuarios, setUsuarios] = useState([]);
    const [tags, setTags] = useState([]);
    const [automations, setAutomations] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [scoreConfig, setScoreConfig] = useState([]);
    const [eventsLog, setEventsLog] = useState([]);
    const [historyLog, setHistoryLog] = useState([]);
    const [loading, setLoading] = useState(true);

    // CRM Automation Matrix State
    const [matrixData, setMatrixData] = useState(DEFAULT_CRM_AUTOMATION_MATRIX);
    const [selectedChannelModal, setSelectedChannelModal] = useState({ isOpen: false, eventId: null, channel: null, eventName: '' });
    const [channelEditForm, setChannelEditForm] = useState({
        enabled: true,
        template_name: '',
        title: '',
        body: '',
        url: '',
        subject: '',
        logo_url: ''
    });
    
    // WEPI Habit Formation Engine State
    const [habitsConfig, setHabitsConfig] = useState(DEFAULT_WEPI_HABITS_CONFIG);
    const [selectedHabitChannelModal, setSelectedHabitChannelModal] = useState({ isOpen: false, momentId: null, channel: null, momentName: '' });
    const [savingHabits, setSavingHabits] = useState(false);
    
    // General Row Edit Modal State
    const [selectedRowModal, setSelectedRowModal] = useState({ isOpen: false, isNew: false, eventId: null });
    const [rowEditForm, setRowEditForm] = useState({
        id: '',
        evento: '',
        estado: 'TODOS',
        comunicacion: 'Seguimiento',
        trigger_type: 'dias_inactividad',
        trigger_label: '',
        trigger_config: { dias: 7, minutos: 30, hora_envio: '12:00', franja: 'Almuerzo', evento_key: 'CARRITO_ABANDONADO', pedidos_count: 3 },
        canales: ['whatsapp', 'push', 'email'],
        enabled: true
    });

    const [savingMatrix, setSavingMatrix] = useState(false);

    // Filter states for Clientes tab
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [cityFilter, setCityFilter] = useState('Todos');
    const [tagFilter, setTagFilter] = useState('Todos');
    const [scoreMinFilter, setScoreMinFilter] = useState('');
    const [ordersMinFilter, setOrdersMinFilter] = useState('');
    const [ordersMaxFilter, setOrdersMaxFilter] = useState('');
    const [orderTimeStart, setOrderTimeStart] = useState('');
    const [orderTimeEnd, setOrderTimeEnd] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todos');
    const [inactivityDaysFilter, setInactivityDaysFilter] = useState('Todos');
    const [selectedUsers, setSelectedUsers] = useState(new Set());

    // Modals and Active Edit objects
    const [selectedUserDetail, setSelectedUserDetail] = useState(null);
    const [userDetailHistory, setUserDetailHistory] = useState([]);
    const [userDetailEvents, setUserDetailEvents] = useState([]);
    const [newTagInput, setNewTagInput] = useState('');
    const [newTagIdInput, setNewTagIdInput] = useState('');
    
    // Automation Form State
    const [showAutomationModal, setShowAutomationModal] = useState(false);
    const [activeAutomation, setActiveAutomation] = useState(null);
    const [automationForm, setAutomationForm] = useState({
        nombre: '',
        evento_disparador: 'USER_REGISTERED',
        condiciones: { ciudad: 'Todos', categoria_favorita: 'Todos' },
        canal: 'push',
        mensaje: '',
        tiempo_espera: 0,
        prioridad: 0,
        estado: true
    });

    // Campaign Form State
    const [campaignForm, setCampaignForm] = useState({
        nombre: '',
        filtros: {
            ciudad: 'Todos',
            estado_crm: 'Todos',
            tag: 'Todos',
            pedidos_min: 0,
            dias_inactivo_min: 0,
            categoria_favorita: 'Todos',
            score_min: 0
        },
        canal: 'whatsapp',
        template_name: '',
        asunto: '',
        mensaje: '',
        estado: 'Borrador',
        fecha_programada: ''
    });

    // Quick template message sender in User Ficha
    const [selectedUserTemplateText, setSelectedUserTemplateText] = useState('');
    // Additional states for Bot Flows & WhatsApp Optins
    const [botFlowData, setBotFlowData] = useState({
        seguimientos: { sin_repartidor: '', repartidores_disponibles: '', enabled: true },
        seguimientos_adquisicion: {
            sin_repartidor: { enabled: true, template: 'sin_repartidores' },
            falta_pago: { enabled: true, template: 'falta_pago' },
            alerta_repartidor: { enabled: true, template: 'estas_disponible' },
            rescate_demanda: { enabled: true, template: 'tenemos_repartidor' }
        }
    });
    const [optins, setOptins] = useState([]);
    const [savingFlows, setSavingFlows] = useState(false);
    const [waSearchTerm, setWaSearchTerm] = useState('');
    const [waModuleFilter, setWaModuleFilter] = useState('Todos');
    const [waChannelFilter, setWaChannelFilter] = useState('Todos');

    useEffect(() => {
        loadAllCRMData();
    }, []);

    // Frontend execution interval for special campaigns
    useEffect(() => {
        const executePendingCampaigns = async () => {
            if (!specialCampaigns || specialCampaigns.length === 0) return;
            const now = new Date();
            
            for (let camp of specialCampaigns) {
                if (!camp.executed && camp.trigger_time && new Date(camp.trigger_time) <= now) {
                    try {
                        // Mark as executed immediately to prevent double firing
                        await api.adminSaveCRMSpecialCampaign({ ...camp, executed: true });
                        setSpecialCampaigns(prev => prev.map(c => c.id === camp.id ? { ...c, executed: true } : c));
                        
                        // Execute messages
                        for (let uid of camp.target_user_ids) {
                            const user = usuarios.find(u => u.id === uid);
                            if (!user) continue;

                            let sent = false;
                            const logData = { campaign_id: camp.id, campaign_nombre: camp.nombre };

                            for (let ch of camp.canales) {
                                if (sent) break;
                                const config = camp.configs[ch];
                                if (!config || !config.enabled) continue;

                                try {
                                    if (ch === 'whatsapp') {
                                        const phone = user.telefono ? user.telefono.replace(/\D/g, '') : null;
                                        if (phone && config.template_name) {
                                            const res = await api.sendWhatsappTemplateMessage({ to: phone, templateName: config.template_name });
                                            if (res && res.success !== false) {
                                                sent = true;
                                                logData.canal = 'whatsapp';
                                            }
                                        }
                                    } else if (ch === 'push') {
                                        if (user.onesignal_id) {
                                            // sendPushNotification throws if it fails
                                            await api.sendPushNotification({ subscriptionIds: [user.onesignal_id], title: config.title, message: config.body, url: config.url });
                                            sent = true;
                                            logData.canal = 'push';
                                        }
                                    } else if (ch === 'email') {
                                        if (user.email) {
                                            // sendCRMActionEmail usually doesn't throw but let's assume it succeeds if it gets here
                                            const emailRes = await api.sendCRMActionEmail(user.email, config.subject, config.body);
                                            if (emailRes && emailRes.success !== false) {
                                                sent = true;
                                                logData.canal = 'email';
                                            } else {
                                                console.warn("Email failed:", emailRes);
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.error(`Error sending ${ch} for user ${uid}`, err);
                                }
                            }
                            
                            if (sent) {
                                await api.adminLogCRMEvent(uid, 'CAMPANA_ESPECIAL', { ...logData, descripcion: `Campaña Especial: ${camp.nombre}` });
                            }
                        }
                    } catch (err) {
                        console.error("Error executing special campaign", camp.id, err);
                    }
                }
            }
        };

        const interval = setInterval(() => {
            executePendingCampaigns();
        }, 30000);
        return () => clearInterval(interval);
    }, [specialCampaigns, usuarios]);

    const handleSaveSpecialCampaign = async () => {
        if (!specialCampaignForm.nombre || !specialCampaignForm.trigger_time) {
            toast.error("El nombre y el horario son obligatorios");
            return;
        }
        setSavingSpecialCampaign(true);
        try {
            const dataToSave = {
                id: specialCampaignForm.id,
                nombre: specialCampaignForm.nombre,
                canales: specialCampaignForm.canales,
                configs: specialCampaignForm.configs,
                trigger_time: new Date(specialCampaignForm.trigger_time).toISOString(),
                target_user_ids: Array.from(selectedUsers),
                executed: false
            };
            if (!dataToSave.id) delete dataToSave.id;
            
            const saved = await api.adminSaveCRMSpecialCampaign(dataToSave);
            toast.success("Campaña especial guardada!");
            setShowSpecialCampaignForm(false);
            setSpecialCampaignForm({ id: null, nombre: '', canales: ['whatsapp', 'push', 'email'], configs: { whatsapp: { enabled: true, template_name: '' }, push: { enabled: true, title: '', body: '', url: '' }, email: { enabled: true, subject: '', body: '' } }, trigger_time: '' });
            setSelectedUsers(new Set()); // clear selection
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al guardar: " + err.message);
        } finally {
            setSavingSpecialCampaign(false);
        }
    };
    
    const handleDivideCampaigns = async () => {
        const numPartes = prompt("¿En cuántas campañas deseas dividir los usuarios seleccionados?");
        if (!numPartes || isNaN(numPartes) || numPartes <= 1) return;
        
        const partes = parseInt(numPartes);
        const usersArray = Array.from(selectedUsers);
        if (usersArray.length === 0) return;

        const chunkSize = Math.ceil(usersArray.length / partes);
        setSavingSpecialCampaign(true);
        try {
            for (let i = 0; i < partes; i++) {
                const chunk = usersArray.slice(i * chunkSize, (i + 1) * chunkSize);
                if (chunk.length === 0) continue;

                // Create placeholder campaign starting in 24 hours just as a safe default
                const defaultDate = new Date();
                defaultDate.setDate(defaultDate.getDate() + 1);

                const dataToSave = {
                    nombre: `NO CONFIGURADO AUN - Parte ${i + 1}`,
                    canales: ['whatsapp', 'push', 'email'],
                    configs: { 
                        whatsapp: { enabled: false, template_name: '' }, 
                        push: { enabled: false, title: '', body: '', url: '' }, 
                        email: { enabled: false, subject: '', body: '' } 
                    },
                    trigger_time: defaultDate.toISOString(),
                    target_user_ids: chunk,
                    executed: false
                };
                await api.adminSaveCRMSpecialCampaign(dataToSave);
            }
            toast.success(`Se crearon ${partes} campañas exitosamente.`);
            setSelectedUsers(new Set()); // clear selection
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al dividir: " + err.message);
        } finally {
            setSavingSpecialCampaign(false);
        }
    };
    
    const handleEditSpecialCampaign = (camp) => {
        // Transform the DB structure back to form state
        // trigger_time needs to be formatted for datetime-local (YYYY-MM-DDThh:mm)
        const dateObj = new Date(camp.trigger_time);
        dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
        const localDateTimeStr = dateObj.toISOString().slice(0, 16);

        setSpecialCampaignForm({
            id: camp.id,
            nombre: camp.nombre,
            canales: camp.canales || ['whatsapp', 'push', 'email'],
            configs: camp.configs || { whatsapp: { enabled: false, template_name: '' }, push: { enabled: false, title: '', body: '', url: '' }, email: { enabled: false, subject: '', body: '' } },
            trigger_time: localDateTimeStr
        });
        // Select the users from the campaign
        setSelectedUsers(new Set(camp.target_user_ids || []));
        setShowSpecialCampaignForm(true);
    };

    const handleDeleteSpecialCampaign = async (id) => {
        if(!window.confirm("¿Eliminar esta campaña especial?")) return;
        try {
            await api.adminDeleteCRMSpecialCampaign(id);
            toast.success("Campaña eliminada");
            loadAllCRMData();
        } catch (e) {
            toast.error("Error al eliminar: " + e.message);
        }
    };
    
    const pendingCampaignsUserIds = useMemo(() => {
        const ids = new Set();
        specialCampaigns.forEach(c => {
            if (!c.executed && c.target_user_ids) {
                c.target_user_ids.forEach(uid => ids.add(uid));
            }
        });
        return ids;
    }, [specialCampaigns]);

    const loadAllCRMData = async () => {
        setLoading(true);
        try {
            const [usersRes, tagsRes, autoRes, campRes, scoreRes, eventsRes, historyRes, matrixRes, habitsRes, botFlowsRes, optinsRes, specialCampRes] = await Promise.all([
                api.adminGetCRMUsers(),
                api.adminGetCRMTags(),
                api.adminGetCRMAutomations(),
                api.adminGetCRMCampaigns(),
                api.adminGetCRMScoreConfig(),
                api.adminGetCRMEvents(),
                api.adminGetCRMHistory(),
                api.adminGetCRMAutomationMatrix().catch(() => null),
                api.adminGetWepiHabitsConfig().catch(() => null),
                api.getWhatsappBotFlows().catch(() => null),
                api.getWhatsappOptins().catch(() => []),
                api.adminGetCRMSpecialCampaigns().catch(() => [])
            ]);

            setUsuarios(usersRes || []);
            setTags(tagsRes || []);
            setAutomations(autoRes || []);
            setCampaigns(campRes || []);
            setScoreConfig(scoreRes || []);
            setEventsLog(eventsRes || []);
            setHistoryLog(historyRes || []);
            setOptins(optinsRes || []);
            setSpecialCampaigns(specialCampRes || []);
            
            let finalMatrix = [...DEFAULT_CRM_AUTOMATION_MATRIX];
            if (matrixRes && Array.isArray(matrixRes) && matrixRes.length > 0) {
                const merged = [...matrixRes];
                DEFAULT_CRM_AUTOMATION_MATRIX.forEach(defItem => {
                    const exists = merged.some(m => m.id === defItem.id || (m.trigger_config?.evento_key && m.trigger_config?.evento_key === defItem.trigger_config?.evento_key));
                    if (!exists) {
                        merged.push(defItem);
                    }
                });
                finalMatrix = merged;
            }
            setMatrixData(finalMatrix);
            if (habitsRes && habitsRes.moments) {
                setHabitsConfig(habitsRes);
            }
            if (botFlowsRes && botFlowsRes.flow_data) {
                setBotFlowData(botFlowsRes.flow_data);
            }
        } catch (err) {
            console.error("Error loading CRM datasets:", err);
            toast.error("Error al cargar datos del CRM. Revisa la base de datos.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBotFlows = async () => {
        setSavingFlows(true);
        try {
            await api.updateWhatsappBotFlows(botFlowData);
            toast.success("Flujos de seguimiento y plantillas de rescate guardados con éxito 🟢");
        } catch (err) {
            toast.error("Error al guardar flujos de seguimiento: " + err.message);
        } finally {
            setSavingFlows(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // INACTIVITY ACTION
    // ─────────────────────────────────────────────────────────────
    const handleRunInactivityScan = async () => {
        const loadToast = toast.loading("Escaneando inactividad de usuarios...");
        try {
            const result = await api.adminRunCRMInactivityCheck();
            toast.dismiss(loadToast);
            if (result && result.success) {
                toast.success(`Escaneo completado. Clientes pasados a DORMIDO: ${result.updated_count}`);
                loadAllCRMData();
            } else {
                toast.error("Error en el escaneo de inactividad");
            }
        } catch (err) {
            toast.dismiss(loadToast);
            toast.error("Error al ejecutar scan: " + err.message);
        }
    };

    // Event Simulation Handler
    const [simEventType, setSimEventType] = useState('CARRITO_ABANDONADO');
    const [simOverrideToken, setSimOverrideToken] = useState('dRgiZ1HtD03RqUBOWIwPt1:APA91bHpqDGFdN2YoZArYHOeXcR5gxOi-1xtZ0VzDLc9hdZrdmlwwqHWIOzjNjBMpj2-w9HbNnF0ejVTAaIGDypAjBpLexFlnSt9dh2dYsZ-v_yT0TOq5rI');

    const handleSimulateCRMEvent = async () => {
        if (!simOverrideToken) {
            toast.error("Ingresa un Token Push de destino para probar");
            return;
        }
        const targetUserId = usuarios[0]?.id || 'test_user';
        const loadToast = toast.loading(`Disparando evento ${simEventType}...`);
        try {
            await api.adminLogCRMEvent(targetUserId, simEventType, { 
                simulated: true, 
                override_token: simOverrideToken,
                triggered_at: new Date().toISOString() 
            });
            toast.dismiss(loadToast);
            toast.success(`¡Evento ${simEventType} enviado a tu Token Push de prueba!`);
            loadAllCRMData();
        } catch (err) {
            toast.dismiss(loadToast);
            toast.error("Error al simular evento: " + err.message);
        }
    };

    const renderProbadorTriggersCard = () => (
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🧪 Probador / Disparador de Triggers CRM en Tiempo Real
                </label>
                <span style={{ fontSize: '0.75rem', color: '#475569', background: '#e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>
                    Las Push se despachan en vivo al Token especificado
                </span>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    🔑 Token OneSignal / Push de Prueba de Destino:
                </label>
                <input 
                    type="text" 
                    className="form-control"
                    style={{ fontSize: '0.78rem', fontFamily: 'monospace', width: '100%', padding: '6px 10px', background: '#ffffff', border: '1px solid #94a3b8', borderRadius: '6px' }}
                    value={simOverrideToken}
                    onChange={(e) => setSimOverrideToken(e.target.value)}
                    placeholder="Token OneSignal / Firebase Push..."
                />
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 2, minWidth: '240px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '2px' }}>Evento / Trigger a Probar:</label>
                    <select 
                        className="form-control"
                        style={{ fontSize: '0.82rem', width: '100%' }}
                        value={simEventType}
                        onChange={(e) => setSimEventType(e.target.value)}
                    >
                        <option value="USUARIO_REGISTRADO">👤 USUARIO_REGISTRADO (1. Registrado / Bienvenida)</option>
                        <option value="VISITA_SIN_COMPRA">👀 VISITA_SIN_COMPRA (2. Visitó sin comprar)</option>
                        <option value="CARRITO_ABANDONADO">🛒 CARRITO_ABANDONADO (3. Carrito abandonado)</option>
                        <option value="PEDIDO_NO_PAGADO">💳 PEDIDO_NO_PAGADO (4. Pedido creado sin pago)</option>
                        <option value="PEDIDO_RECHAZADO_FALTA_PAGO">❌ PEDIDO_RECHAZADO_FALTA_PAGO (5. Pago rechazado)</option>
                        <option value="sin_repartidores">🛵 sin_repartidores (6. Aviso 1 Sin Repartidores)</option>
                        <option value="PEDIDO_RECHAZADO_SIN_REPARTIDOR_2">⏱️ PEDIDO_RECHAZADO_SIN_REPARTIDOR_2 (7. Refuerzo 5 min)</option>
                        <option value="ESPERANDO_REPARTIDOR">🛵 ESPERANDO_REPARTIDOR (8. Demora 15 min)</option>
                        <option value="PEDIDO_ACEPTADO">👨‍🍳 PEDIDO_ACEPTADO (9. En preparación)</option>
                        <option value="REPARTIDOR_ASIGNADO">🚴 REPARTIDOR_ASIGNADO (10. Repartidor asignado)</option>
                        <option value="PEDIDO_RETIRADO">📦 PEDIDO_RETIRADO (11. Retirado en camino)</option>
                        <option value="REPARTIDOR_CERCA">📍 REPARTIDOR_CERCA (12. A menos de 500m)</option>
                        <option value="PEDIDO_ENTREGADO">✅ PEDIDO_ENTREGADO (13. Entregado / Satisfacción)</option>
                    </select>
                </div>

                <div style={{ marginTop: '18px' }}>
                    <button 
                        type="button" 
                        className="btn btn-primary"
                        style={{ fontSize: '0.85rem', padding: '8px 18px', whiteSpace: 'nowrap', fontWeight: 'bold', background: '#2563eb', cursor: 'pointer' }}
                        onClick={handleSimulateCRMEvent}
                    >
                        🚀 Probador / Disparar Evento
                    </button>
                </div>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────
    // CLASIFICACION & KPIs
    // ─────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = usuarios.length;
        const porEstado = {
            VISITANTE: 0,
            REGISTRADO: 0,
            PRIMER_PEDIDO: 0,
            CLIENTE_ACTIVO: 0,
            CLIENTE_FRECUENTE: 0,
            VIP: 0,
            DORMIDO: 0,
            RECUPERADO: 0
        };

        let totalSpent = 0;
        let totalOrders = 0;
        let usersWithOrders = 0;

        usuarios.forEach(u => {
            const st = u.estado_crm || 'REGISTRADO';
            if (porEstado[st] !== undefined) porEstado[st]++;
            
            const orders = Number(u.cantidad_pedidos) || 0;
            const spent = Number(u.total_gastado) || 0;
            
            totalOrders += orders;
            totalSpent += spent;
            if (orders > 0) usersWithOrders++;
        });

        const recoveredCount = porEstado.RECUPERADO || 0;
        const dormantCount = porEstado.DORMIDO || 0;
        const totalTargetedForRecovery = dormantCount + recoveredCount;
        const recoveryRate = totalTargetedForRecovery > 0 ? ((recoveredCount / totalTargetedForRecovery) * 100).toFixed(1) : 0;
        
        return {
            total,
            porEstado,
            avgOrders: total > 0 ? (totalOrders / total).toFixed(1) : 0,
            avgTicket: usersWithOrders > 0 ? (totalSpent / totalOrders).toFixed(0) : 0,
            totalSpent,
            recoveryRate
        };
    }, [usuarios]);

    // ─────────────────────────────────────────────────────────────
    // CLIENTES: FILTRADO Y BUSQUEDA
    // ─────────────────────────────────────────────────────────────
    const filteredUsers = useMemo(() => {
        return usuarios.filter(user => {
            // Search
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                !searchTerm ||
                (user.nombre && user.nombre.toLowerCase().includes(searchLower)) ||
                (user.email && user.email.toLowerCase().includes(searchLower)) ||
                (user.telefono && user.telefono.includes(searchTerm));

            // State
            const matchesStatus = statusFilter === 'Todos' || user.estado_crm === statusFilter;

            // City
            const matchesCity = cityFilter === 'Todos' || user.ciudad === cityFilter;

            // Dynamic Tag
            const matchesTag = tagFilter === 'Todos' || (user.crm_usuario_tags && user.crm_usuario_tags.some(t => t.tag_id === tagFilter));

            // Category
            const matchesCategory = categoryFilter === 'Todos' || user.categoria_favorita === categoryFilter;

            // Score
            const scoreVal = Number(user.wepi_score) || 0;
            const matchesScore = !scoreMinFilter || scoreVal >= Number(scoreMinFilter);

            // Orders
            const ordersVal = Number(user.cantidad_pedidos) || 0;
            const matchesOrdersMin = !ordersMinFilter || ordersVal >= Number(ordersMinFilter);
            const matchesOrdersMax = !ordersMaxFilter || ordersVal <= Number(ordersMaxFilter);

            // Inactivity days
            let matchesInactivity = true;
            if (inactivityDaysFilter !== 'Todos') {
                const daysVal = user.fecha_ultimo_pedido ? Math.floor((new Date() - new Date(user.fecha_ultimo_pedido)) / (1000 * 60 * 60 * 24)) : 999;
                if (inactivityDaysFilter === '7') matchesInactivity = daysVal >= 7 && daysVal < 15;
                else if (inactivityDaysFilter === '15') matchesInactivity = daysVal >= 15 && daysVal < 30;
                else if (inactivityDaysFilter === '30') matchesInactivity = daysVal >= 30 && daysVal < 60;
                else if (inactivityDaysFilter === '60') matchesInactivity = daysVal >= 60 && daysVal < 90;
                else if (inactivityDaysFilter === '90') matchesInactivity = daysVal >= 90;
            }

            // Order Time
            let matchesOrderTime = true;
            if (orderTimeStart || orderTimeEnd) {
                if (user.fecha_ultimo_pedido) {
                    const d = new Date(user.fecha_ultimo_pedido);
                    // Add timezone offset to get local hour correctly, or just use getHours/getMinutes which are local
                    const hh = d.getHours().toString().padStart(2, '0');
                    const mm = d.getMinutes().toString().padStart(2, '0');
                    const timeStr = `${hh}:${mm}`;
                    
                    if (orderTimeStart && timeStr < orderTimeStart) matchesOrderTime = false;
                    if (orderTimeEnd && timeStr > orderTimeEnd) matchesOrderTime = false;
                } else {
                    matchesOrderTime = false; // No orders, so it doesn't match a time filter
                }
            }

            return matchesSearch && matchesStatus && matchesCity && matchesTag && matchesCategory && matchesScore && matchesOrdersMin && matchesOrdersMax && matchesInactivity && matchesOrderTime;
        });
    }, [usuarios, searchTerm, statusFilter, cityFilter, tagFilter, categoryFilter, scoreMinFilter, ordersMinFilter, ordersMaxFilter, inactivityDaysFilter, orderTimeStart, orderTimeEnd]);

    // Dynamic Lists (Quick Access Lists)
    const handleQuickAccessList = (listType) => {
        setSearchTerm('');
        setCityFilter('Todos');
        setTagFilter('Todos');
        setCategoryFilter('Todos');
        setScoreMinFilter('');
        setOrdersMinFilter('');
        setOrdersMaxFilter('');
        setOrderTimeStart('');
        setOrderTimeEnd('');
        setInactivityDaysFilter('Todos');
        
        if (listType === 'prospectos') {
            setStatusFilter('Todos');
            setInactivityDaysFilter('Todos');
            // Prospects are registered but have 0 orders
            setSearchTerm('');
            // Filter below manually
            setUsuarios(prev => prev.map(u => u)); // trigger recalculate
            setStatusFilter('REGISTRADO');
        } else {
            setStatusFilter(listType.toUpperCase());
        }
    };

    // User Selection Handlers
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
        } else {
            setSelectedUsers(new Set());
        }
    };

    const handleSelectUser = (id) => {
        const next = new Set(selectedUsers);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedUsers(next);
    };

    // Bulk action tags
    const handleBulkTagAdd = async (tagId) => {
        if (!tagId || selectedUsers.size === 0) return;
        const load = toast.loading(`Añadiendo etiqueta ${tagId} a ${selectedUsers.size} usuarios...`);
        try {
            await Promise.all(
                Array.from(selectedUsers).map(uid => api.adminAddTagToUser(uid, tagId).catch(() => null))
            );
            toast.dismiss(load);
            toast.success("Etiquetas aplicadas con éxito");
            loadAllCRMData();
        } catch (err) {
            toast.dismiss(load);
            toast.error("Error al aplicar etiquetas masivas");
        }
    };

    // Copiar teléfonos en formato internacional separados por coma
    const copySelectedPhones = () => {
        if (selectedUsers.size === 0) return;
        
        const selectedList = usuarios.filter(u => selectedUsers.has(u.id));
        const formattedPhones = selectedList
            .map(u => {
                const rawPhone = u.telefono || '';
                // Limpiar espacios, guiones, paréntesis y símbolos de suma sobrantes
                let clean = rawPhone.replace(/[\s\-\(\)\+]/g, '');
                if (!clean) return null;
                
                // Brasil (código de país 55)
                if (clean.startsWith('55')) {
                    return '+' + clean;
                }
                
                // Argentina (código de país 54)
                if (clean.startsWith('54')) {
                    if (clean.startsWith('549')) {
                        return '+' + clean;
                    } else {
                        // Insertar el prefijo móvil internacional '9'
                        return '+549' + clean.substring(2);
                    }
                }
                
                // Formatos locales argentinos
                if (clean.length === 10) {
                    return '+549' + clean;
                }
                
                if (clean.length === 11 && clean.startsWith('9')) {
                    return '+549' + clean.substring(1);
                }
                
                if (clean.startsWith('0') && clean.length === 11) {
                    return '+549' + clean.substring(1);
                }
                
                if (clean.startsWith('15') && clean.length === 8) {
                    const areaCode = u.ciudad === 'Oberá' ? '3755' : '3756';
                    return '+549' + areaCode + clean.substring(2);
                }
                
                if (clean.length === 8) {
                    const areaCode = u.ciudad === 'Oberá' ? '3755' : '3756';
                    return '+549' + areaCode + clean;
                }

                if (clean.length >= 10) {
                    if (clean.startsWith('9')) {
                        return '+549' + clean.substring(1);
                    }
                    return '+549' + clean;
                }

                return '+549' + clean; // fallback general para Argentina
            })
            .filter(Boolean);

        if (formattedPhones.length === 0) {
            toast.error("No hay números de teléfono válidos para copiar");
            return;
        }

        const textToCopy = formattedPhones.join(',');
        navigator.clipboard.writeText(textToCopy).then(() => {
            toast.success(`Se copiaron ${formattedPhones.length} teléfonos en formato internacional`);
        }).catch(err => {
            toast.error("Error al copiar al portapapeles");
            console.error(err);
        });
    };

    // Ficha de Usuario (Modal)
    const handleOpenUserDetail = async (user) => {
        setSelectedUserDetail(user);
        setSelectedUserTemplateText('');
        try {
            const [history, events] = await Promise.all([
                api.adminGetCRMHistory(user.id),
                api.adminGetCRMEvents(user.id)
            ]);
            setUserDetailHistory(history || []);
            setUserDetailEvents(events || []);
        } catch (err) {
            toast.error("Error al cargar historial del usuario");
        }
    };

    const handleAddUserTag = async (userId, tagId) => {
        if (!tagId) return;
        try {
            await api.adminAddTagToUser(userId, tagId);
            toast.success("Etiqueta añadida");
            // Refresh detail mapping
            setUsuarios(prev => prev.map(u => {
                if (u.id === userId) {
                    const activeTags = u.crm_usuario_tags || [];
                    if (!activeTags.some(t => t.tag_id === tagId)) {
                        return { ...u, crm_usuario_tags: [...activeTags, { tag_id: tagId }] };
                    }
                }
                return u;
            }));
        } catch (err) {
            toast.error("Error al añadir etiqueta");
        }
    };

    const handleRemoveUserTag = async (userId, tagId) => {
        try {
            await api.adminRemoveTagFromUser(userId, tagId);
            toast.success("Etiqueta eliminada");
            setUsuarios(prev => prev.map(u => {
                if (u.id === userId) {
                    return { ...u, crm_usuario_tags: (u.crm_usuario_tags || []).filter(t => t.tag_id !== tagId) };
                }
                return u;
            }));
        } catch (err) {
            toast.error("Error al eliminar etiqueta");
        }
    };

    const handleSendDirectMessage = async () => {
        if (!selectedUserDetail) return;
        if (!selectedUserTemplateText) {
            toast.error("Por favor, escribe un mensaje");
            return;
        }

        const loader = toast.loading("Enviando mensaje...");
        try {
            const result = await api.adminSendCRMMessage(
                selectedUserDetail.id,
                selectedUserTemplateChannel,
                selectedUserTemplateText
            );
            toast.dismiss(loader);
            if (result.success) {
                toast.success(`Mensaje procesado: ${result.logDetail}`);
                // Refresh log
                const history = await api.adminGetCRMHistory(selectedUserDetail.id);
                setUserDetailHistory(history);
            }
        } catch (err) {
            toast.dismiss(loader);
            toast.error("Error al enviar mensaje: " + err.message);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // AUTOMATIZACIONES
    // ─────────────────────────────────────────────────────────────
    const handleOpenNewAutomation = () => {
        setActiveAutomation(null);
        setAutomationForm({
            nombre: '',
            evento_disparador: 'USER_REGISTERED',
            condiciones: { ciudad: 'Todos', categoria_favorita: 'Todos' },
            canal: 'push',
            mensaje: '',
            tiempo_espera: 0,
            prioridad: 0,
            estado: true
        });
        setShowAutomationModal(true);
    };

    const handleOpenEditAutomation = (aut) => {
        setActiveAutomation(aut);
        setAutomationForm({
            ...aut,
            condiciones: aut.condiciones || { ciudad: 'Todos', categoria_favorita: 'Todos' }
        });
        setShowAutomationModal(true);
    };

    const handleSaveAutomation = async () => {
        if (!automationForm.nombre || !automationForm.mensaje) {
            toast.error("Completa el nombre y mensaje");
            return;
        }

        try {
            const data = {
                ...automationForm,
                id: activeAutomation ? activeAutomation.id : undefined
            };
            await api.adminSaveCRMAutomation(data);
            toast.success("Automatización guardada");
            setShowAutomationModal(false);
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al guardar automatización: " + err.message);
        }
    };

    const handleDeleteAutomation = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta automatización?")) return;
        try {
            await api.adminDeleteCRMAutomation(id);
            toast.success("Automatización eliminada");
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al eliminar");
        }
    };

    const handleToggleAutomationStatus = async (aut) => {
        try {
            const updated = { ...aut, estado: !aut.estado };
            await api.adminSaveCRMAutomation(updated);
            toast.success(updated.estado ? "Automatización activada" : "Automatización desactivada");
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al cambiar estado");
        }
    };

    // ─────────────────────────────────────────────────────────────
    // MATRIX AUTOMATIONS HANDLERS
    // ─────────────────────────────────────────────────────────────
    const getTriggerSummaryLabel = (row) => {
        const type = row.trigger_type || 'dias_inactividad';
        const cfg = row.trigger_config || {};
        if (type === 'dias_inactividad') {
            return `🗓️ ${cfg.dias || 7} días sin pedir`;
        } else if (type === 'minutos_post_entrega') {
            return `⏱️ ${cfg.minutos || 30} min tras entrega`;
        } else if (type === 'horario_consumo') {
            return `⏰ ${cfg.hora_envio || '12:00'} (${cfg.franja || 'Almuerzo'})`;
        } else if (type === 'frecuencia_pedidos') {
            return `📊 ${cfg.pedidos_count || 3} pedidos acumulados`;
        } else if (type === 'evento_sistema') {
            return `⚡ ${cfg.evento_key || row.trigger_label || row.trigger || 'Evento Sistema'}`;
        }
        return row.trigger_label || row.trigger || 'Personalizado';
    };

    const handleToggleMatrixRow = (eventId) => {
        setMatrixData(prev => prev.map(row => row.id === eventId ? { ...row, enabled: !row.enabled } : row));
    };

    const handleOpenRowEditModal = (row) => {
        if (!row) {
            // New Event
            const newId = 'evento_' + Date.now();
            setSelectedRowModal({ isOpen: true, isNew: true, eventId: newId });
            setRowEditForm({
                id: newId,
                evento: 'Nuevo Evento CRM',
                estado: 'TODOS',
                comunicacion: 'Seguimiento',
                trigger_type: 'dias_inactividad',
                trigger_label: '7 días sin pedir',
                trigger_config: { dias: 7, minutos: 30, hora_envio: '12:00', franja: 'Almuerzo', evento_key: 'CARRITO_ABANDONADO', pedidos_count: 3 },
                canales: ['whatsapp', 'push', 'email'],
                configs: {
                    whatsapp: { enabled: true, template_name: '' },
                    push: { enabled: true, title: '', body: '', url: '/pedir' },
                    email: { enabled: true, subject: '', body: '', url: '', logo_url: '' }
                },
                enabled: true
            });
        } else {
            setSelectedRowModal({ isOpen: true, isNew: false, eventId: row.id });
            setRowEditForm({
                id: row.id,
                evento: row.evento || row.estado || 'Evento',
                estado: row.estado_crm || row.estado || 'TODOS',
                comunicacion: row.comunicacion || 'Seguimiento',
                trigger_type: row.trigger_type || 'dias_inactividad',
                trigger_label: row.trigger_label || row.trigger || '',
                trigger_config: row.trigger_config || { dias: 7, minutos: 30, hora_envio: '12:00', franja: 'Almuerzo', evento_key: 'CARRITO_ABANDONADO', pedidos_count: 3 },
                canales: row.canales || ['whatsapp', 'push', 'email'],
                configs: row.configs || {},
                enabled: row.enabled !== false
            });
        }
    };

    const handleSaveRowConfig = () => {
        if (!rowEditForm.evento) {
            toast.error("Por favor ingresa un nombre para el evento");
            return;
        }

        // Automatic trigger label calculation
        let label = rowEditForm.trigger_label;
        if (rowEditForm.trigger_type === 'dias_inactividad') {
            label = `${rowEditForm.trigger_config.dias} días sin pedir`;
        } else if (rowEditForm.trigger_type === 'minutos_post_entrega') {
            label = `${rowEditForm.trigger_config.minutos} min tras entrega`;
        } else if (rowEditForm.trigger_type === 'horario_consumo') {
            label = `${rowEditForm.trigger_config.hora_envio} hs (${rowEditForm.trigger_config.franja})`;
        } else if (rowEditForm.trigger_type === 'frecuencia_pedidos') {
            label = `${rowEditForm.trigger_config.pedidos_count} pedidos`;
        } else if (rowEditForm.trigger_type === 'evento_sistema') {
            label = rowEditForm.trigger_config.evento_key;
        }

        const updatedRow = {
            ...rowEditForm,
            trigger_label: label,
            trigger: label
        };

        if (selectedRowModal.isNew) {
            setMatrixData(prev => [...prev, updatedRow]);
            toast.success("Nuevo evento registrado en la matriz");
        } else {
            setMatrixData(prev => prev.map(r => r.id === selectedRowModal.eventId ? updatedRow : r));
            toast.success("Evento actualizado");
        }

        setSelectedRowModal({ isOpen: false, isNew: false, eventId: null });
    };

    const handleDeleteRow = (eventId) => {
        if (!window.confirm("¿Seguro que deseas eliminar este evento de la matriz?")) return;
        setMatrixData(prev => prev.filter(r => r.id !== eventId));
        toast.success("Evento eliminado de la matriz");
    };

    const handleOpenChannelModal = (row, channelType) => {
        if (channelType === 'none') return;
        const cfg = (row.configs && row.configs[channelType]) || { enabled: true };
        setSelectedChannelModal({ isOpen: true, eventId: row.id, channel: channelType, eventName: row.evento || row.estado });
        setChannelEditForm({
            enabled: cfg.enabled !== false,
            template_name: cfg.template_name || '',
            title: cfg.title || '',
            body: cfg.body || '',
            url: cfg.url || '',
            subject: cfg.subject || '',
            logo_url: cfg.logo_url || ''
        });
    };

    const handleSaveChannelConfig = () => {
        const { eventId, channel } = selectedChannelModal;
        if (!eventId || !channel) return;

        setMatrixData(prev => prev.map(row => {
            if (row.id === eventId) {
                const updatedConfigs = { ...(row.configs || {}) };
                updatedConfigs[channel] = { ...channelEditForm };
                return { ...row, configs: updatedConfigs };
            }
            return row;
        }));

        setSelectedChannelModal({ isOpen: false, eventId: null, channel: null, eventName: '' });
        toast.success("Configuración de canal actualizada");
    };

    const handleChannelOrderChange = (eventId, channelIndex, newChannelType) => {
        setMatrixData(prev => prev.map(row => {
            if (row.id === eventId) {
                const newCanales = [...row.canales];
                newCanales[channelIndex] = newChannelType;
                return { ...row, canales: newCanales };
            }
            return row;
        }));
    };

    const handleSaveEntireMatrix = async () => {
        setSavingMatrix(true);
        const loader = toast.loading("Guardando matriz de automatizaciones...");
        try {
            const res = await api.adminSaveCRMAutomationMatrix(matrixData);
            toast.dismiss(loader);
            if (res && res.is_local_fallback) {
                toast.success("¡Matriz guardada localmente! (Ejecuta create_crm_automation_engine.sql en Supabase) 🟡");
            } else {
                toast.success("¡Matriz de Automatizaciones guardada en Supabase con éxito! 🟢");
            }
        } catch (err) {
            toast.dismiss(loader);
            toast.error("Error al guardar la matriz: " + err.message);
        } finally {
            setSavingMatrix(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // HABIT ENGINE HANDLERS
    // ─────────────────────────────────────────────────────────────
    const handleUpdateHabitsGlobalSettings = (key, val) => {
        setHabitsConfig(prev => ({
            ...prev,
            global_settings: {
                ...prev.global_settings,
                [key]: val
            }
        }));
    };

    const handleToggleHabitMoment = (momentId) => {
        setHabitsConfig(prev => ({
            ...prev,
            moments: prev.moments.map(m => m.id === momentId ? { ...m, enabled: !m.enabled } : m)
        }));
    };

    const handleHabitMomentTimeChange = (momentId, newTime) => {
        setHabitsConfig(prev => ({
            ...prev,
            moments: prev.moments.map(m => m.id === momentId ? { ...m, hora: newTime } : m)
        }));
    };

    const handleHabitMomentChannelOrderChange = (momentId, channelIdx, newChannelType) => {
        setHabitsConfig(prev => ({
            ...prev,
            moments: prev.moments.map(m => {
                if (m.id === momentId) {
                    const newCanales = [...m.canales];
                    newCanales[channelIdx] = newChannelType;
                    return { ...m, canales: newCanales };
                }
                return m;
            })
        }));
    };

    const handleOpenHabitChannelModal = (moment, channelType) => {
        if (channelType === 'none') return;
        const cfg = (moment.configs && moment.configs[channelType]) || { enabled: true };
        setSelectedHabitChannelModal({ isOpen: true, momentId: moment.id, channel: channelType, momentName: moment.nombre });
        setChannelEditForm({
            enabled: cfg.enabled !== false,
            template_name: cfg.template_name || '',
            title: cfg.title || '',
            body: cfg.body || '',
            url: cfg.url || '',
            subject: cfg.subject || '',
            logo_url: cfg.logo_url || ''
        });
    };

    const handleSaveHabitChannelConfig = () => {
        const { momentId, channel } = selectedHabitChannelModal;
        if (!momentId || !channel) return;

        setHabitsConfig(prev => ({
            ...prev,
            moments: prev.moments.map(m => {
                if (m.id === momentId) {
                    const updatedConfigs = { ...(m.configs || {}) };
                    updatedConfigs[channel] = { ...channelEditForm };
                    return { ...m, configs: updatedConfigs };
                }
                return m;
            })
        }));

        setSelectedHabitChannelModal({ isOpen: false, momentId: null, channel: null, momentName: '' });
        toast.success("Configuración de canal de hábito actualizada");
    };

    const handleSaveEntireHabitsConfig = async () => {
        setSavingHabits(true);
        const loader = toast.loading("Guardando Motor de Hábitos de WEPI...");
        try {
            const res = await api.adminSaveWepiHabitsConfig(habitsConfig);
            toast.dismiss(loader);
            if (res && res.is_local_fallback) {
                toast.success("¡Motor de Hábitos guardado localmente! (Ejecuta create_wepi_habit_engine.sql en Supabase) 🟡");
            } else {
                toast.success("¡Motor de Hábitos guardado en Supabase con éxito! 🧠");
            }
        } catch (err) {
            toast.dismiss(loader);
            toast.error("Error al guardar la configuración de hábitos: " + err.message);
        } finally {
            setSavingHabits(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // CAMPAÑAS
    // ─────────────────────────────────────────────────────────────
    const targetedCampaignUsersCount = useMemo(() => {
        const f = campaignForm.filtros;
        return usuarios.filter(user => {
            const matchesCity = f.ciudad === 'Todos' || user.ciudad === f.ciudad;
            const matchesState = f.estado_crm === 'Todos' || user.estado_crm === f.estado_crm;
            const matchesTag = f.tag === 'Todos' || (user.crm_usuario_tags && user.crm_usuario_tags.some(t => t.tag_id === f.tag));
            const matchesOrders = (Number(user.cantidad_pedidos) || 0) >= (Number(f.pedidos_min) || 0);
            
            const daysVal = user.fecha_ultimo_pedido ? Math.floor((new Date() - new Date(user.fecha_ultimo_pedido)) / (1000 * 60 * 60 * 24)) : 999;
            const matchesInact = daysVal >= (Number(f.dias_inactivo_min) || 0);
            
            const matchesCat = f.categoria_favorita === 'Todos' || user.categoria_favorita === f.categoria_favorita;
            const matchesScore = (Number(user.wepi_score) || 0) >= (Number(f.score_min) || 0);

            return matchesCity && matchesState && matchesTag && matchesOrders && matchesInact && matchesCat && matchesScore;
        }).length;
    }, [usuarios, campaignForm.filtros]);

    const handleLaunchCampaign = async () => {
        if (!campaignForm.nombre) {
            toast.error("Por favor ingresa un nombre para la campaña");
            return;
        }

        if (campaignForm.canal === 'whatsapp' && !campaignForm.template_name) {
            toast.error("Para campañas por WhatsApp debes ingresar el Nombre de la Plantilla Meta (HSM)");
            return;
        }

        if ((campaignForm.canal === 'push' || campaignForm.canal === 'email') && !campaignForm.mensaje) {
            toast.error("Completa el contenido del mensaje de la campaña");
            return;
        }

        const isScheduled = !!campaignForm.fecha_programada;
        const msgType = isScheduled ? "programar" : "lanzar";
        
        if (!window.confirm(`¿Seguro que deseas ${msgType} esta campaña para ${targetedCampaignUsersCount} usuarios?`)) {
            return;
        }

        const loader = toast.loading(`${isScheduled ? 'Programando' : 'Ejecutando'} campaña...`);
        try {
            const f = campaignForm.filtros;
            const targets = usuarios.filter(user => {
                const matchesCity = f.ciudad === 'Todos' || user.ciudad === f.ciudad;
                const matchesState = f.estado_crm === 'Todos' || user.estado_crm === f.estado_crm;
                const matchesTag = f.tag === 'Todos' || (user.crm_usuario_tags && user.crm_usuario_tags.some(t => t.tag_id === f.tag));
                const matchesOrders = (Number(user.cantidad_pedidos) || 0) >= (Number(f.pedidos_min) || 0);
                
                const daysVal = user.fecha_ultimo_pedido ? Math.floor((new Date() - new Date(user.fecha_ultimo_pedido)) / (1000 * 60 * 60 * 24)) : 999;
                const matchesInact = daysVal >= (Number(f.dias_inactivo_min) || 0);
                
                const matchesCat = f.categoria_favorita === 'Todos' || user.categoria_favorita === f.categoria_favorita;
                const matchesScore = (Number(user.wepi_score) || 0) >= (Number(f.score_min) || 0);

                return matchesCity && matchesState && matchesTag && matchesOrders && matchesInact && matchesCat && matchesScore;
            });

            let successCount = 0;
            let failedCount = 0;

            if (!isScheduled) {
                // Send messages
                const msgContent = campaignForm.canal === 'whatsapp' 
                    ? `Plantilla Meta HSM: ${campaignForm.template_name}` 
                    : campaignForm.mensaje;

                for (const u of targets) {
                    try {
                        const result = await api.adminSendCRMMessage(u.id, campaignForm.canal, msgContent, campaignForm.nombre);
                        if (result.success) {
                            successCount++;
                        } else {
                            failedCount++;
                        }
                    } catch (e) {
                        failedCount++;
                        console.error("Failed sending message to user during campaign:", u.id, e);
                    }
                }
            }

            // Save Campaign with execution metrics
            const data = {
                ...campaignForm,
                mensaje: campaignForm.canal === 'whatsapp' ? `Plantilla Meta HSM: ${campaignForm.template_name}` : campaignForm.mensaje,
                estado: isScheduled ? 'Programada' : 'Enviada',
                fecha_programada: isScheduled ? new Date(campaignForm.fecha_programada).toISOString() : null,
                total_audiencia: targets.length,
                enviados_exito: successCount,
                fallidos: failedCount
            };
            
            await api.adminSaveCRMCampaign(data);

            if (!isScheduled) {
                toast.dismiss(loader);
                toast.success(`¡Campaña enviada! Despachos exitosos: ${successCount} de ${targets.length} (Fallidos/Sin Opt-in: ${failedCount})`);
            } else {
                toast.dismiss(loader);
                toast.success("Campaña programada exitosamente");
            }
            
            // Reset Campaign Form
            setCampaignForm({
                nombre: '',
                filtros: {
                    ciudad: 'Todos',
                    estado_crm: 'Todos',
                    tag: 'Todos',
                    pedidos_min: 0,
                    dias_inactivo_min: 0,
                    categoria_favorita: 'Todos',
                    score_min: 0
                },
                canal: 'whatsapp',
                template_name: '',
                asunto: '',
                mensaje: '',
                estado: 'Borrador',
                fecha_programada: ''
            });

            loadAllCRMData();
        } catch (err) {
            toast.dismiss(loader);
            toast.error("Error al procesar la campaña: " + err.message);
        }
    };

    const handleDeleteCampaign = async (id) => {
        if (!window.confirm("¿Eliminar esta campaña del historial?")) return;
        try {
            await api.adminDeleteCRMCampaign(id);
            toast.success("Campaña eliminada");
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al eliminar campaña");
        }
    };

    // ─────────────────────────────────────────────────────────────
    // RETENCION COHORT STATISTICS
    // ─────────────────────────────────────────────────────────────
    const retentionCohorts = useMemo(() => {
        const now = new Date();
        const ranges = [
            { id: '7', label: '7 a 14 días sin comprar', min: 7, max: 14 },
            { id: '15', label: '15 a 29 días sin comprar', min: 15, max: 29 },
            { id: '30', label: '30 a 59 días sin comprar (Alerta Inactivos)', min: 30, max: 59 },
            { id: '60', label: '60 a 89 días sin comprar', min: 60, max: 89 },
            { id: '90', label: 'Más de 90 días sin comprar (Dormidos críticos)', min: 90, max: 9999 }
        ];

        return ranges.map(rng => {
            const segmentUsers = usuarios.filter(u => {
                if (!u.fecha_ultimo_pedido) return false;
                const days = Math.floor((now - new Date(u.fecha_ultimo_pedido)) / (1000 * 60 * 60 * 24));
                return days >= rng.min && days <= rng.max;
            });

            // Conversion (Users in segment who made orders later? Let's check history or look at recoveries)
            const recoveredInSegment = segmentUsers.filter(u => u.estado_crm === 'RECUPERADO').length;
            const rate = segmentUsers.length > 0 ? ((recoveredInSegment / segmentUsers.length) * 100).toFixed(1) : '0';

            // Messages count: count messages logged in history log linked to these users
            const uids = new Set(segmentUsers.map(u => u.id));
            const msgCount = historyLog.filter(h => h.tipo === 'mensaje_enviado' && uids.has(h.usuario_id)).length;

            return {
                ...rng,
                count: segmentUsers.length,
                rate,
                messagesSent: msgCount
            };
        });
    }, [usuarios, historyLog]);

    const handleFilterCohort = (cohortId) => {
        setInactivityDaysFilter(cohortId);
        setStatusFilter('Todos');
        setActiveTab('clientes');
    };

    const handlePrepopulateCohortCampaign = (cohortId) => {
        const rng = retentionCohorts.find(r => r.id === cohortId);
        setCampaignForm(prev => ({
            ...prev,
            nombre: `Campaña de Retención - ${rng.label}`,
            filtros: {
                ...prev.filtros,
                dias_inactivo_min: rng.min,
                estado_crm: cohortId >= 30 ? 'DORMIDO' : 'Todos'
            }
        }));
        setActiveTab('campanas');
    };

    // ─────────────────────────────────────────────────────────────
    // CONFIGURACION: TAGS DYNAMIC
    // ─────────────────────────────────────────────────────────────
    const handleCreateTag = async () => {
        if (!newTagIdInput || !newTagInput) {
            toast.error("Completa la ID y el Nombre de la etiqueta");
            return;
        }
        const cleanedId = newTagIdInput.toUpperCase().replace(/[\s-]/g, '_');
        try {
            await api.adminCreateCRMTag(cleanedId, newTagInput);
            toast.success("Etiqueta registrada");
            setNewTagIdInput('');
            setNewTagInput('');
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al registrar etiqueta (posible ID duplicada)");
        }
    };

    const handleDeleteTag = async (tagId) => {
        if (!window.confirm(`¿Seguro que deseas eliminar la etiqueta ${tagId}? Se desvinculará de todos los usuarios.`)) return;
        try {
            await api.adminDeleteCRMTag(tagId);
            toast.success("Etiqueta eliminada");
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al eliminar etiqueta");
        }
    };

    // CONFIGURACION: WEPI SCORE WEIGHTS
    const handleUpdateScoreWeight = (configId, val) => {
        setScoreConfig(prev => prev.map(c => c.id === configId ? { ...c, puntos: parseInt(val) || 0 } : c));
    };

    const handleSaveScoreWeights = async () => {
        const loader = toast.loading("Guardando pesos del Score...");
        try {
            await api.adminSaveCRMScoreConfig(scoreConfig);
            toast.dismiss(loader);
            toast.success("Puntajes de Score actualizados. Los scores se recalcularán automáticamente con futuros pedidos.");
            loadAllCRMData();
        } catch (err) {
            toast.dismiss(loader);
            toast.error("Error al guardar configuraciones de score: " + err.message);
        }
    };

    // Format utility
    const formatCurrency = (val) => {
        return `$${(Number(val) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
    };

    const formatDateStr = (date) => {
        if (!date) return 'Nunca';
        return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Loading State
    if (loading) {
        return (
            <div className="crm-loading-wrapper">
                <div className="spinner"></div>
                <p>Cargando panel CRM y automatizaciones de Wepi...</p>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER MONITOR DE ENVÍOS MULTICANAL (WhatsApp, Push, Email)
    // ─────────────────────────────────────────────────────────────
    const renderMonitorDeEnviosSection = () => {
        const filteredHistory = historyLog.filter(h => {
            const u = usuarios.find(usr => usr.id === h.usuario_id);
            const q = waSearchTerm.toLowerCase();
            const channel = (h.canal || h.metadata?.channel || (h.tipo?.includes('whatsapp') ? 'whatsapp' : h.tipo?.includes('push') ? 'push' : 'email')).toLowerCase();
            const triggerEvent = h.metadata?.event_type || h.metadata?.rule_id || h.descripcion || '';
            const templateOrTitle = h.metadata?.template_name || h.metadata?.title || h.metadata?.subject || h.descripcion || 'Mensaje enviado';

            const matchesSearch = !q || 
                (u?.nombre && u.nombre.toLowerCase().includes(q)) ||
                (u?.telefono && u.telefono.toLowerCase().includes(q)) ||
                (u?.email && u.email.toLowerCase().includes(q)) ||
                (h.metadata?.customer_name && h.metadata.customer_name.toLowerCase().includes(q)) ||
                (h.metadata?.phone && h.metadata.phone.toLowerCase().includes(q)) ||
                (h.metadata?.to && h.metadata.to.toLowerCase().includes(q)) ||
                (h.descripcion && h.descripcion.toLowerCase().includes(q)) ||
                (triggerEvent && triggerEvent.toLowerCase().includes(q)) ||
                (templateOrTitle && templateOrTitle.toLowerCase().includes(q));

            let matchesModule = true;
            if (waModuleFilter === 'habitos') matchesModule = h.tipo?.includes('habit') || h.tipo?.includes('desayuno') || h.tipo?.includes('almuerzo') || h.tipo?.includes('cena');
            else if (waModuleFilter === 'matriz') matchesModule = h.tipo?.includes('auto') || h.tipo?.includes('matriz') || h.tipo?.includes('carrito') || h.tipo?.includes('automatizacion');
            else if (waModuleFilter === 'campanas') matchesModule = h.tipo?.includes('campana');
            else if (waModuleFilter === 'seguimientos') matchesModule = h.tipo?.includes('seguimiento') || h.tipo?.includes('rescate') || h.metadata?.template_name === 'sin_repartidores';

            let matchesChannel = true;
            if (waChannelFilter === 'whatsapp') matchesChannel = channel.includes('whatsapp') || channel === 'wa';
            else if (waChannelFilter === 'push') matchesChannel = channel.includes('push');
            else if (waChannelFilter === 'email') matchesChannel = channel.includes('email');

            return matchesSearch && matchesModule && matchesChannel;
        });

        const totalEnviados = historyLog.length;
        const totalWa = historyLog.filter(h => h.canal === 'whatsapp' || h.tipo?.includes('whatsapp') || h.metadata?.channel === 'whatsapp').length;
        const totalPush = historyLog.filter(h => h.canal === 'push' || h.tipo?.includes('push') || h.metadata?.channel === 'push').length;
        const totalEmail = historyLog.filter(h => h.canal === 'email' || h.tipo?.includes('email') || h.metadata?.channel === 'email').length;

        return (
            <div className="tab-pane animate-fade-in" style={{ padding: '4px' }}>
                <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📡 Monitor de Envíos Multicanal (WhatsApp HSM, Push & Email)
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#475569' }}>
                            Supervisión y auditoría en tiempo real con disparadores, clientes, plantillas y canales despachados.
                        </p>
                    </div>
                    <span style={{ fontSize: '0.85rem', background: '#e0f2fe', color: '#0369a1', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold' }}>
                        🟢 Opt-ins Activos: {optins.length} clientes
                    </span>
                </div>

                {/* KPI Cards */}
                <div className="crm-kpis" style={{ marginBottom: '24px' }}>
                    <div className="kpi-card" style={{ borderLeft: '4px solid #64748b' }}>
                        <h3>{totalEnviados}</h3>
                        <p>📦 Total Despachados</p>
                    </div>
                    <div className="kpi-card" style={{ borderLeft: '4px solid #25d366' }}>
                        <h3>{totalWa}</h3>
                        <p>💬 WhatsApp HSM</p>
                    </div>
                    <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                        <h3>{totalPush}</h3>
                        <p>🔔 Push Notifications</p>
                    </div>
                    <div className="kpi-card" style={{ borderLeft: '4px solid #ea580c' }}>
                        <h3>{totalEmail}</h3>
                        <p>📧 Emails Despachados</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="filters-panel" style={{ marginBottom: '20px' }}>
                    <div className="filters-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                        <div className="filter-item">
                            <label>Buscar por Cliente / Teléfono / Disparador / Plantilla</label>
                            <input 
                                type="text" 
                                placeholder="Nombre, teléfono, disparador o plantilla..." 
                                value={waSearchTerm}
                                onChange={(e) => setWaSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="filter-item">
                            <label>Filtrar por Módulo</label>
                            <select value={waModuleFilter} onChange={(e) => setWaModuleFilter(e.target.value)}>
                                <option value="Todos">Todos los módulos</option>
                                <option value="matriz">⚙️ Matriz CRM</option>
                                <option value="habitos">🧠 Motor de Hábitos</option>
                                <option value="campanas">🚀 Campañas</option>
                                <option value="seguimientos">🔄 Flujos de Seguimiento</option>
                            </select>
                        </div>
                        <div className="filter-item">
                            <label>Filtrar por Canal</label>
                            <select value={waChannelFilter} onChange={(e) => setWaChannelFilter(e.target.value)}>
                                <option value="Todos">Todos los canales</option>
                                <option value="whatsapp">💬 WhatsApp HSM</option>
                                <option value="push">🔔 Push Notification</option>
                                <option value="email">📧 Email</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Log Table */}
                <div className="dashboard-card">
                    <h3>📡 Registros de Auditoría y Monitor de Envíos</h3>
                    <div className="table-responsive">
                        <table className="crm-simple-table">
                            <thead>
                                <tr>
                                    <th>Fecha / Hora</th>
                                    <th>Cliente / Contacto</th>
                                    <th>Disparador / Evento</th>
                                    <th>Módulo CRM</th>
                                    <th>Canal</th>
                                    <th>Plantilla / Mensaje</th>
                                    <th>Estado de Envío</th>
                                    <th>Verificación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistory.map((log) => {
                                    const u = usuarios.find(usr => usr.id === log.usuario_id);
                                    const rawPhone = u?.telefono || log.metadata?.phone || log.metadata?.to || 'Sin teléfono';
                                    let cleanPhone = rawPhone.replace(/[\s-]/g, '');
                                    if (cleanPhone.length >= 10 && !cleanPhone.startsWith('+') && !cleanPhone.startsWith('5')) {
                                        cleanPhone = '549' + cleanPhone;
                                    } else if (cleanPhone.startsWith('+')) {
                                        cleanPhone = cleanPhone.substring(1);
                                    }

                                    const rawChannel = (log.canal || log.metadata?.channel || (log.tipo?.includes('whatsapp') ? 'whatsapp' : log.tipo?.includes('push') ? 'push' : (log.tipo === 'evento_importante' || log.tipo === 'cambio_estado') ? 'sistema' : 'email')).toLowerCase();
                                    const triggerEvent = log.metadata?.event_type || log.metadata?.rule_id || (log.tipo?.includes('habit') ? 'HÁBITO_RECURRENTE' : log.tipo?.includes('campana') ? 'CAMPAÑA_MASIVA' : log.tipo === 'cambio_estado' ? 'CAMBIO_ESTADO' : 'EVENTO_SISTEMA_DB');
                                    const templateOrTitle = log.metadata?.template_name || log.metadata?.title || log.metadata?.subject || log.descripcion || 'Notificación';
                                    const isRescate = log.tipo?.includes('rescate') || templateOrTitle === 'sin_repartidores' || log.tipo?.includes('seguimiento');

                                    return (
                                        <tr key={log.id}>
                                            <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                {formatDateStr(log.created_at)} <br />
                                                <span style={{ color: '#64748b' }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                                            </td>
                                            <td>
                                                <strong>{u?.nombre || log.metadata?.customer_name || 'Cliente Wepi'}</strong>
                                                <br /><span style={{ fontSize: '0.78rem', color: '#64748b' }}>{rawPhone || u?.email || log.usuario_id}</span>
                                            </td>
                                            <td>
                                                <code style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.78rem' }}>
                                                    {triggerEvent}
                                                </code>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', background: log.tipo?.includes('habit') ? '#e0f2fe' : log.tipo?.includes('campana') ? '#fef3c7' : isRescate ? '#ffedd5' : '#f3e8ff', color: log.tipo?.includes('habit') ? '#0369a1' : log.tipo?.includes('campana') ? '#b45309' : isRescate ? '#c2410c' : '#7e22ce' }}>
                                                    {log.tipo?.includes('habit') ? '🧠 Hábitos' : log.tipo?.includes('campana') ? '🚀 Campaña' : isRescate ? '🔄 Seguimientos' : '⚙️ Matriz CRM'}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', background: rawChannel.includes('whatsapp') || rawChannel === 'wa' ? '#dcfce7' : rawChannel.includes('push') ? '#dbeafe' : rawChannel === 'sistema' ? '#f1f5f9' : '#ffedd5', color: rawChannel.includes('whatsapp') || rawChannel === 'wa' ? '#15803d' : rawChannel.includes('push') ? '#1d4ed8' : rawChannel === 'sistema' ? '#475569' : '#c2410c' }}>
                                                    {rawChannel.includes('whatsapp') || rawChannel === 'wa' ? '💬 WhatsApp' : rawChannel.includes('push') ? '🔔 Push' : rawChannel === 'sistema' ? '⚡ DB / Trigger' : '📧 Email'}
                                                </span>
                                            </td>
                                            <td>
                                                <code style={{ background: '#f1f5f9', color: '#0f172a', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.78rem' }}>
                                                    {templateOrTitle}
                                                </code>
                                            </td>
                                            <td>
                                                <span style={{ background: rawChannel === 'sistema' ? '#e2e8f0' : '#dcfce7', color: rawChannel === 'sistema' ? '#334155' : '#15803d', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                                    {rawChannel.includes('whatsapp') ? '✅ Meta API Enviado' : rawChannel.includes('push') ? '🔔 Push Entregado' : rawChannel === 'sistema' ? '📝 Log de Auditoría DB' : '📧 Email Despachado'}
                                                </span>
                                            </td>
                                            <td>
                                                {(rawChannel.includes('whatsapp') || rawChannel === 'wa') && cleanPhone ? (
                                                    <a 
                                                        href={`https://wa.me/${cleanPhone}`} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="btn-small"
                                                        style={{ textDecoration: 'none', background: '#25d366', color: '#fff', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        💬 Abrir Chat
                                                    </a>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredHistory.length === 0 && (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                            No hay registros de envíos que coincidan con los filtros aplicados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="wepi-crm-container animate-fade-in">
            {/* Header section */}
            <div className="wepi-crm-header">
                <div className="header-titles">
                    <h1>Growth & Retention CRM</h1>
                    <p>Gestión y automatización de clientes basado en eventos y comportamiento</p>
                </div>
                <div className="header-actions">
                    <button className="btn-scan" onClick={handleRunInactivityScan}>
                        🔄 Escanear Inactividad
                    </button>
                </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="wepi-crm-tabs">
                <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
                    📊 Dashboard
                </button>
                <button className={activeTab === 'monitor_wa' ? 'active' : ''} onClick={() => setActiveTab('monitor_wa')}>
                    📡 Monitor de Envíos
                </button>
                <button className={activeTab === 'clientes' ? 'active' : ''} onClick={() => setActiveTab('clientes')}>
                    👥 Clientes y Listas
                </button>
                <button className={activeTab === 'automatizaciones' ? 'active' : ''} onClick={() => setActiveTab('automatizaciones')}>
                    ⚙️ Automatizaciones CRM
                </button>
                <button className={activeTab === 'habitos' ? 'active' : ''} onClick={() => setActiveTab('habitos')}>
                    🧠 Motor de Hábitos
                </button>
                <button className={activeTab === 'campanas' ? 'active' : ''} onClick={() => setActiveTab('campanas')}>
                    🚀 Campañas
                </button>
                <button className={activeTab === 'retencion' ? 'active' : ''} onClick={() => setActiveTab('retencion')}>
                    🎯 Retención
                </button>
                <button className={activeTab === 'configuracion' ? 'active' : ''} onClick={() => setActiveTab('configuracion')}>
                    🛠️ Configuración
                </button>
            </div>

            {/* TAB CONTENT: DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="tab-pane">
                    {/* KPI Panel */}
                    <div className="crm-kpis">
                        <div className="kpi-card">
                            <h3>{stats.total}</h3>
                            <p>Contactos Registrados</p>
                        </div>
                        <div className="kpi-card vip">
                            <h3>{stats.porEstado.VIP || 0}</h3>
                            <p>Clientes VIP</p>
                        </div>
                        <div className="kpi-card active-crm">
                            <h3>{stats.porEstado.CLIENTE_ACTIVO + stats.porEstado.CLIENTE_FRECUENTE || 0}</h3>
                            <p>Clientes Activos</p>
                        </div>
                        <div className="kpi-card dormant">
                            <h3>{stats.porEstado.DORMIDO || 0}</h3>
                            <p>Clientes Dormidos</p>
                        </div>
                        <div className="kpi-card ticket">
                            <h3>{formatCurrency(stats.avgTicket)}</h3>
                            <p>Ticket Promedio</p>
                        </div>
                        <div className="kpi-card recovery-pct">
                            <h3>{stats.recoveryRate}%</h3>
                            <p>Tasa de Recuperación</p>
                        </div>
                    </div>

                    {/* Mid Section Graphs & Feeds */}
                    <div className="dashboard-grid">
                        {/* Users by State Graph (SVG Pure) */}
                        <div className="dashboard-card">
                            <h3>Distribución de Usuarios por Estado</h3>
                            <div className="state-chart-container">
                                {Object.entries(stats.porEstado).map(([state, count]) => {
                                    const pct = stats.total > 0 ? ((count / stats.total) * 100) : 0;
                                    return (
                                        <div key={state} className="chart-bar-row">
                                            <span className="state-label">{state}</span>
                                            <div className="bar-wrapper">
                                                <div className={`bar-fill state-${state.toLowerCase()}`} style={{ width: `${Math.max(3, pct)}%` }}></div>
                                                <span className="bar-value">{count} ({pct.toFixed(0)}%)</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Recent Events Feed with Event Simulator */}
                        <div className="dashboard-card feed">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ margin: 0 }}>Eventos Recientes del CRM</h3>
                            </div>

                            {renderProbadorTriggersCard()}

                            <div className="events-feed-list">
                                {eventsLog.slice(0, 8).map(ev => {
                                    const u = usuarios.find(usr => usr.id === ev.usuario_id);
                                    return (
                                        <div key={ev.id} className="feed-item">
                                            <div className="feed-icon">💡</div>
                                            <div className="feed-info">
                                                <p>
                                                    <strong>{u?.nombre || 'Usuario desc.'}</strong> disparó event <code style={{ background: ev.event_type === 'CARRITO_ABANDONADO' ? '#fef3c7' : ev.event_type === 'PEDIDO_NO_PAGADO' ? '#fee2e2' : '#e0f2fe', color: ev.event_type === 'CARRITO_ABANDONADO' ? '#b45309' : ev.event_type === 'PEDIDO_NO_PAGADO' ? '#b91c1c' : '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{ev.event_type}</code>
                                                </p>
                                                <span>{formatDateStr(ev.created_at)} - {new Date(ev.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {eventsLog.length === 0 && <p className="empty">No hay eventos registrados en la base de datos.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Middle Section: Performance & Attribution Table by Template/Channel */}
                    <div className="dashboard-card" style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0 }}>📊 Rendimiento y Atribución por Plantilla / Canal (24 hs)</h3>
                            <span style={{ fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                                🎯 Atribución Ventana 24 hs
                            </span>
                        </div>
                        <div className="table-responsive">
                            <table className="crm-simple-table">
                                <thead>
                                    <tr>
                                        <th>Plantilla / Evento</th>
                                        <th>Canal</th>
                                        <th>Mensajes Enviados</th>
                                        <th>Clics / Interacciones</th>
                                        <th>Pedidos (24h)</th>
                                        <th>Tasa Conversión</th>
                                        <th>Revenue Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { name: 'desayuno_sugerencia', canal: 'whatsapp', tipo: 'HSM Meta', enviados: historyLog.filter(h => h.tipo?.includes('desayuno')).length || 1, clics: Math.floor((historyLog.filter(h => h.tipo?.includes('desayuno')).length || 1) * 0.4), pedidos: Math.floor((historyLog.filter(h => h.tipo?.includes('desayuno')).length || 1) * 0.1), revenue: Math.floor((historyLog.filter(h => h.tipo?.includes('desayuno')).length || 1) * 0.1) * 4200 },
                                        { name: 'almuerzo_sugerencia', canal: 'push', tipo: 'Push App', enviados: historyLog.filter(h => h.tipo?.includes('almuerzo')).length || 1, clics: Math.floor((historyLog.filter(h => h.tipo?.includes('almuerzo')).length || 1) * 0.35), pedidos: Math.floor((historyLog.filter(h => h.tipo?.includes('almuerzo')).length || 1) * 0.08), revenue: Math.floor((historyLog.filter(h => h.tipo?.includes('almuerzo')).length || 1) * 0.08) * 4500 },
                                        { name: 'reactivacion_carrito_1', canal: 'whatsapp', tipo: 'HSM Meta', enviados: historyLog.filter(h => h.tipo?.includes('carrito')).length || 1, clics: Math.floor((historyLog.filter(h => h.tipo?.includes('carrito')).length || 1) * 0.6), pedidos: Math.floor((historyLog.filter(h => h.tipo?.includes('carrito')).length || 1) * 0.25), revenue: Math.floor((historyLog.filter(h => h.tipo?.includes('carrito')).length || 1) * 0.25) * 4800 },
                                        { name: 'cena_sugerencia', canal: 'push', tipo: 'Push App', enviados: historyLog.filter(h => h.tipo?.includes('cena')).length || 1, clics: Math.floor((historyLog.filter(h => h.tipo?.includes('cena')).length || 1) * 0.45), pedidos: Math.floor((historyLog.filter(h => h.tipo?.includes('cena')).length || 1) * 0.12), revenue: Math.floor((historyLog.filter(h => h.tipo?.includes('cena')).length || 1) * 0.12) * 5100 }
                                    ].map((row, idx) => {
                                        const convRate = row.enviados > 0 ? ((row.pedidos / row.enviados) * 100).toFixed(1) : '0.0';
                                        return (
                                            <tr key={idx}>
                                                <td><strong style={{ color: '#0f172a' }}>{row.name}</strong></td>
                                                <td>
                                                    <span className={`btn-channel-badge ${row.canal}`} style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '6px' }}>
                                                        {row.canal === 'whatsapp' ? '💬 WhatsApp' : row.canal === 'push' ? '🔔 Push' : '📧 Email'}
                                                    </span>
                                                </td>
                                                <td style={{ fontWeight: 'bold' }}>{row.enviados}</td>
                                                <td>{row.clics}</td>
                                                <td><span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.8rem' }}>{row.pedidos} pedidos</span></td>
                                                <td style={{ fontWeight: 'bold', color: '#2563eb' }}>{convRate} %</td>
                                                <td style={{ fontWeight: 'bold', color: '#059669' }}>{formatCurrency(row.revenue)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Lower Section: Execution Logs */}
                    <div className="dashboard-card">
                        <h3>Registro de Automatizaciones Ejecutadas</h3>
                        <div className="table-responsive">
                            <table className="crm-simple-table">
                                <thead>
                                    <tr>
                                        <th>Fecha/Hora</th>
                                        <th>Cliente</th>
                                        <th>Detalle</th>
                                        <th>Canal</th>
                                        <th>Información</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyLog.filter(h => h.tipo === 'automatizacion_ejecutada').slice(0, 5).map(log => {
                                        const u = usuarios.find(usr => usr.id === log.usuario_id);
                                        return (
                                            <tr key={log.id}>
                                                <td>{formatDateStr(log.created_at)} {new Date(log.created_at).toLocaleTimeString()}</td>
                                                <td><strong>{u?.nombre || 'Desconocido'}</strong></td>
                                                <td>{log.descripcion}</td>
                                                <td><span className="badge-channel">{log.metadata?.channel || 'push'}</span></td>
                                                <td>Event: {log.metadata?.event_type || 'Pedido'}</td>
                                            </tr>
                                        );
                                    })}
                                    {historyLog.filter(h => h.tipo === 'automatizacion_ejecutada').length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center' }}>No hay automatizaciones ejecutadas recientemente.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 📡 MONITOR DE ENVÍOS MULTICANAL FUNCTION */}
            {(() => {
                if (activeTab !== 'monitor_wa') return null;
                return renderMonitorDeEnviosSection();
            })()}



            {/* TAB CONTENT: CLIENTES */}
            {activeTab === 'clientes' && (
                <div className="tab-pane">
                    {/* Quick filter lists */}
                    <div className="quick-lists">
                        <span className="label">Listas Automáticas:</span>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('prospectos')}>Prospectos</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('registrado')}>Registrados</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('primer_pedido')}>Primer Pedido</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('cliente_activo')}>Activos</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('vip')}>VIPs</button>
                        <button className="btn-quick-list animate-pulse" onClick={() => handleQuickAccessList('dormido')}>Dormidos</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('recuperado')}>Recuperados</button>
                    </div>

                    {/* Advanced filter panel */}
                    <div className="filters-panel">
                        <div className="filters-grid">
                            <div className="filter-item">
                                <label>Buscar Cliente</label>
                                <input 
                                    type="text" 
                                    placeholder="Nombre, email, teléfono..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="filter-item">
                                <label>Estado CRM</label>
                                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                    <option value="Todos">Todos los estados</option>
                                    <option value="VISITANTE">Visitante</option>
                                    <option value="REGISTRADO">Registrado</option>
                                    <option value="PRIMER_PEDIDO">Primer Pedido</option>
                                    <option value="CLIENTE_ACTIVO">Cliente Activo</option>
                                    <option value="CLIENTE_FRECUENTE">Cliente Frecuente</option>
                                    <option value="VIP">VIP</option>
                                    <option value="DORMIDO">Dormido</option>
                                    <option value="RECUPERADO">Recuperado</option>
                                </select>
                            </div>
                            <div className="filter-item">
                                <label>Ciudad</label>
                                <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                                    <option value="Todos">Todas las ciudades</option>
                                    <option value="Santo Tomé">Santo Tomé</option>
                                    <option value="Oberá">Oberá</option>
                                </select>
                            </div>
                            <div className="filter-item">
                                <label>Etiqueta</label>
                                <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                                    <option value="Todos">Cualquier etiqueta</option>
                                    {tags.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-item">
                                <label>Cat. Favorita</label>
                                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                                    <option value="Todos">Cualquier categoría</option>
                                    <option value="Helados">Helados</option>
                                    <option value="Farmacia">Farmacia</option>
                                    <option value="Shops">Shops</option>
                                    <option value="Pizzas">Pizzas</option>
                                    <option value="Hamburguesas">Hamburguesas</option>
                                    <option value="Lomitos">Lomitos</option>
                                    <option value="Empanadas">Empanadas</option>
                                    <option value="Bebidas">Bebidas</option>
                                </select>
                            </div>
                            <div className="filter-item">
                                <label>Score Wepi Mín.</label>
                                <input 
                                    type="number" 
                                    placeholder="Ej: 50"
                                    value={scoreMinFilter}
                                    onChange={(e) => setScoreMinFilter(e.target.value)}
                                />
                            </div>
                            <div className="filter-item">
                                <label>Pedidos Mín.</label>
                                <input 
                                    type="number" 
                                    placeholder="Ej: 3"
                                    value={ordersMinFilter}
                                    onChange={(e) => setOrdersMinFilter(e.target.value)}
                                />
                            </div>
                            <div className="filter-item">
                                <label>Pedidos Máx.</label>
                                <input 
                                    type="number" 
                                    placeholder="Ej: 10"
                                    value={ordersMaxFilter}
                                    onChange={(e) => setOrdersMaxFilter(e.target.value)}
                                />
                            </div>
                            <div className="filter-item">
                                <label>Hora Pedido Desde</label>
                                <input 
                                    type="time" 
                                    value={orderTimeStart}
                                    onChange={(e) => setOrderTimeStart(e.target.value)}
                                />
                            </div>
                            <div className="filter-item">
                                <label>Hora Pedido Hasta</label>
                                <input 
                                    type="time" 
                                    value={orderTimeEnd}
                                    onChange={(e) => setOrderTimeEnd(e.target.value)}
                                />
                            </div>
                            <div className="filter-item">
                                <label>Inactividad</label>
                                <select value={inactivityDaysFilter} onChange={(e) => setInactivityDaysFilter(e.target.value)}>
                                    <option value="Todos">Cualquier período</option>
                                    <option value="7">7 a 14 días sin comprar</option>
                                    <option value="15">15 a 29 días sin comprar</option>
                                    <option value="30">30 a 59 días sin comprar</option>
                                    <option value="60">60 a 89 días sin comprar</option>
                                    <option value="90">Más de 90 días sin comprar</option>
                                </select>
                            </div>
                        </div>

                        {/* Bulk Action Controls */}
                        {selectedUsers.size > 0 && (
                            <div className="bulk-actions-wrapper">
                                <span><strong>{selectedUsers.size} seleccionados:</strong></span>
                                <div className="bulk-buttons">
                                    <select 
                                        className="select-action"
                                        onChange={(e) => {
                                            handleBulkTagAdd(e.target.value);
                                            e.target.value = '';
                                        }}
                                    >
                                        <option value="">Añadir etiqueta masiva...</option>
                                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <button 
                                        className="btn-bulk-campaign"
                                        onClick={() => {
                                            setShowSpecialCampaignForm(true);
                                            setSpecialCampaignForm(prev => ({
                                                ...prev,
                                                nombre: `Campaña Especial - ${selectedUsers.size} seleccionados`
                                            }));
                                        }}
                                    >
                                        ✉️ Crear Campaña Especial
                                    </button>
                                    <button 
                                        className="btn-bulk-campaign"
                                        onClick={handleDivideCampaigns}
                                        style={{ background: '#f59e0b', color: '#fff', border: 'none', marginLeft: '5px' }}
                                    >
                                        ➗ Dividir en Campañas
                                    </button>
                                    <button 
                                        className="btn-copy-phones"
                                        onClick={copySelectedPhones}
                                        style={{
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            padding: '7px 14px',
                                            borderRadius: '6px',
                                            fontWeight: '700',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        📋 Copiar Teléfonos
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Special Campaigns Form & List */}
                        {showSpecialCampaignForm && (
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginTop: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                <h4 style={{marginTop:0, marginBottom:'10px'}}>Configurador de Campaña Especial Inline</h4>
                                <div style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px'}}>
                                    <div style={{flex:1}}>
                                        <label>Nombre de Campaña:</label>
                                        <input type="text" className="form-control" value={specialCampaignForm.nombre} onChange={e => setSpecialCampaignForm({...specialCampaignForm, nombre: e.target.value})} />
                                    </div>
                                    <div style={{flex:1}}>
                                        <label>Horario de Disparador:</label>
                                        <input type="datetime-local" className="form-control" value={specialCampaignForm.trigger_time} onChange={e => setSpecialCampaignForm({...specialCampaignForm, trigger_time: e.target.value})} />
                                    </div>
                                </div>
                                <div style={{marginBottom:'10px'}}>
                                    <label>Prioridad de Envío (Cascada):</label>
                                    <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                        {[0, 1, 2].map(idx => (
                                            <div key={idx} style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                                <span>{idx + 1}°</span>
                                                <select 
                                                    className="form-control" 
                                                    style={{width: 'auto'}}
                                                    value={specialCampaignForm.canales[idx] || 'none'}
                                                    onChange={e => {
                                                        const newCanales = [...specialCampaignForm.canales];
                                                        newCanales[idx] = e.target.value;
                                                        setSpecialCampaignForm({...specialCampaignForm, canales: newCanales});
                                                    }}
                                                >
                                                    <option value="none">Ninguno</option>
                                                    <option value="whatsapp">WhatsApp</option>
                                                    <option value="push">Push</option>
                                                    <option value="email">Email</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{display:'flex', gap:'15px', flexWrap:'wrap', background:'#fff', padding:'10px', borderRadius:'8px', border:'1px solid #e2e8f0', marginBottom:'10px'}}>
                                    <div style={{flex:1, minWidth:'250px'}}>
                                        <label style={{fontWeight:'bold'}}>🟢 WhatsApp</label>
                                        <div>
                                            <input type="checkbox" checked={specialCampaignForm.configs.whatsapp.enabled} onChange={e => setSpecialCampaignForm({...specialCampaignForm, configs: {...specialCampaignForm.configs, whatsapp: {...specialCampaignForm.configs.whatsapp, enabled: e.target.checked}}})} /> Habilitar WhatsApp
                                        </div>
                                        {specialCampaignForm.configs.whatsapp.enabled && (
                                            <input type="text" className="form-control" placeholder="Nombre Template (ej: sin_repartidores)" value={specialCampaignForm.configs.whatsapp.template_name} onChange={e => setSpecialCampaignForm({...specialCampaignForm, configs: {...specialCampaignForm.configs, whatsapp: {...specialCampaignForm.configs.whatsapp, template_name: e.target.value}}})} />
                                        )}
                                    </div>
                                    <div style={{flex:1, minWidth:'250px'}}>
                                        <label style={{fontWeight:'bold'}}>🔴 Push Notification</label>
                                        <div>
                                            <input type="checkbox" checked={specialCampaignForm.configs.push.enabled} onChange={e => setSpecialCampaignForm({...specialCampaignForm, configs: {...specialCampaignForm.configs, push: {...specialCampaignForm.configs.push, enabled: e.target.checked}}})} /> Habilitar Push
                                        </div>
                                        {specialCampaignForm.configs.push.enabled && (
                                            <>
                                                <input type="text" className="form-control" placeholder="Título" value={specialCampaignForm.configs.push.title} onChange={e => setSpecialCampaignForm({...specialCampaignForm, configs: {...specialCampaignForm.configs, push: {...specialCampaignForm.configs.push, title: e.target.value}}})} style={{marginBottom:'5px'}} />
                                                <textarea className="form-control" placeholder="Mensaje" value={specialCampaignForm.configs.push.body} onChange={e => setSpecialCampaignForm({...specialCampaignForm, configs: {...specialCampaignForm.configs, push: {...specialCampaignForm.configs.push, body: e.target.value}}})} style={{marginBottom:'5px'}} />
                                                <input type="text" className="form-control" placeholder="URL Destino (ej: /pedir)" value={specialCampaignForm.configs.push.url} onChange={e => setSpecialCampaignForm({...specialCampaignForm, configs: {...specialCampaignForm.configs, push: {...specialCampaignForm.configs.push, url: e.target.value}}})} />
                                            </>
                                        )}
                                    </div>
                                    <div style={{flex:1, minWidth:'250px'}}>
                                        <label style={{fontWeight:'bold'}}>📧 Email</label>
                                        <div>
                                            <input type="checkbox" checked={specialCampaignForm.configs.email.enabled} onChange={e => setSpecialCampaignForm({...specialCampaignForm, configs: {...specialCampaignForm.configs, email: {...specialCampaignForm.configs.email, enabled: e.target.checked}}})} /> Habilitar Email
                                        </div>
                                        {specialCampaignForm.configs.email.enabled && (
                                            <>
                                                <input type="text" className="form-control" placeholder="Asunto" value={specialCampaignForm.configs.email.subject} onChange={e => setSpecialCampaignForm({...specialCampaignForm, configs: {...specialCampaignForm.configs, email: {...specialCampaignForm.configs.email, subject: e.target.value}}})} style={{marginBottom:'5px'}} />
                                                <textarea className="form-control" placeholder="Cuerpo HTML/Texto" value={specialCampaignForm.configs.email.body} onChange={e => setSpecialCampaignForm({...specialCampaignForm, configs: {...specialCampaignForm.configs, email: {...specialCampaignForm.configs.email, body: e.target.value}}})} />
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div style={{display:'flex', gap:'10px'}}>
                                    <button className="btn btn-primary" onClick={handleSaveSpecialCampaign} disabled={savingSpecialCampaign}>{savingSpecialCampaign ? 'Guardando...' : 'Guardar y Programar'}</button>
                                    <button className="btn btn-secondary" onClick={() => setShowSpecialCampaignForm(false)}>Cancelar</button>
                                </div>
                            </div>
                        )}
                        
                        {specialCampaigns.length > 0 && (
                            <div style={{ marginTop: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                                <h5 style={{marginTop:0}}>Campaña Especiales Pendientes/Ejecutadas</h5>
                                <table className="crm-table" style={{marginTop:'10px', width: '100%'}}>
                                    <thead><tr><th>Nombre</th><th>Usuarios</th><th>Horario</th><th>Estado</th><th>Acciones</th></tr></thead>
                                    <tbody>
                                        {specialCampaigns.map(c => (
                                            <tr key={c.id}>
                                                <td>{c.nombre}</td>
                                                <td>{c.target_user_ids?.length || 0} users</td>
                                                <td>{new Date(c.trigger_time).toLocaleString()}</td>
                                                <td>{c.executed ? <span style={{color:'green', fontWeight:'bold'}}>Ejecutada</span> : <span style={{color:'orange', fontWeight:'bold'}}>Pendiente</span>}</td>
                                                <td>
                                                    <button className="btn-icon" onClick={() => handleEditSpecialCampaign(c)} title="Editar">✏️</button>
                                                    <button className="btn-icon" onClick={() => handleDeleteSpecialCampaign(c.id)} title="Eliminar">🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Clientes Table */}
                    <div className="table-wrapper">
                        <table className="crm-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <input 
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                                        />
                                    </th>
                                    <th>Cliente</th>
                                    <th>Ciudad</th>
                                    <th>Score Wepi</th>
                                    <th>Pedidos</th>
                                    <th>Total Gastado</th>
                                    <th>Ticket Prom.</th>
                                    <th>Último Pedido</th>
                                    <th>Favorito</th>
                                    <th>Estado CRM</th>
                                    <th>Etiquetas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => {
                                    const tagsJoined = user.crm_usuario_tags || [];
                                    return (
                                        <tr key={user.id} className="user-row">
                                            <td>
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedUsers.has(user.id)}
                                                    disabled={pendingCampaignsUserIds.has(user.id)}
                                                    title={pendingCampaignsUserIds.has(user.id) ? 'Usuario bloqueado: Ya está en una campaña especial pendiente' : ''}
                                                    onChange={() => handleSelectUser(user.id)}
                                                />
                                            </td>
                                            <td>
                                                <div className="clickable-name" onClick={() => handleOpenUserDetail(user)}>
                                                    <strong>{user.nombre || 'Sin Nombre'}</strong>
                                                    <span>{user.telefono || '-'}</span>
                                                </div>
                                            </td>
                                            <td>{user.ciudad || 'Santo Tomé'}</td>
                                            <td>
                                                <span className="badge-score">{user.wepi_score || 0} pts</span>
                                            </td>
                                            <td><strong>{user.cantidad_pedidos || 0}</strong></td>
                                            <td>{formatCurrency(user.total_gastado)}</td>
                                            <td>{formatCurrency(user.ticket_promedio)}</td>
                                            <td>{user.fecha_ultimo_pedido ? `${formatDateStr(user.fecha_ultimo_pedido)} ${new Date(user.fecha_ultimo_pedido).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '-'}</td>
                                            <td><span className="badge-category">{user.categoria_favorita || '-'}</span></td>
                                            <td>
                                                <span className={`badge-crm state-${(user.estado_crm || 'REGISTRADO').toLowerCase()}`}>
                                                    {user.estado_crm || 'REGISTRADO'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="tag-badges-container">
                                                    {tagsJoined.map(t => {
                                                        const tagObj = tags.find(tag => tag.id === t.tag_id);
                                                        return (
                                                            <span key={t.tag_id} className="tag-badge">
                                                                {tagObj ? tagObj.name : t.tag_id}
                                                            </span>
                                                        );
                                                    })}
                                                    {tagsJoined.length === 0 && <span className="no-tags">-</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredUsers.length === 0 && (
                                    <tr><td colSpan="11" style={{ textAlign: 'center', padding: '30px' }}>No se encontraron usuarios que coincidan con los filtros.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: AUTOMATIZACIONES */}
            {activeTab === 'automatizaciones' && (
                <div className="tab-pane animate-fade-in">
                    {renderProbadorTriggersCard()}
                    <div className="matrix-header-info">
                        <div>
                            <h2>🤖 Panel de Automatizaciones por Eventos (Multicanal)</h2>
                            <p>Configura eventos, disparadores dinámicos y la prioridad de canales (1°, 2° y 3° opción) para cada estado de cliente.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-primary" onClick={() => handleOpenRowEditModal(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ➕ Añadir Nuevo Evento
                            </button>
                            <button className="btn-launch" onClick={handleSaveEntireMatrix} disabled={savingMatrix}>
                                💾 {savingMatrix ? 'Guardando...' : 'Guardar Matriz'}
                            </button>
                        </div>
                    </div>

                    <div className="matrix-table-card">
                        <div className="matrix-table-responsive">
                            <table className="matrix-table">
                                <thead>
                                    <tr>
                                        <th>Evento / Escenario</th>
                                        <th>Estado CRM</th>
                                        <th>Trigger / Disparador</th>
                                        <th>Comunicación</th>
                                        <th>🥇 1° Canal</th>
                                        <th>🥈 2° Canal</th>
                                        <th>🥉 3° Canal</th>
                                        <th style={{ textAlign: 'center' }}>Acciones</th>
                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matrixData.map(row => (
                                        <tr key={row.id} className={row.enabled ? '' : 'row-disabled'}>
                                            <td style={{ fontWeight: '700', color: '#0f172a' }}>{row.evento || row.estado}</td>
                                            <td>
                                                <span className={`badge-crm state-${(row.estado_crm || row.estado || 'TODOS').toLowerCase()}`} style={{ fontSize: '0.75rem' }}>
                                                    {row.estado_crm || row.estado || 'TODOS'}
                                                </span>
                                            </td>
                                            <td>
                                                <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '0.82rem', color: '#0f172a', fontWeight: '600' }}>
                                                    {getTriggerSummaryLabel(row)}
                                                </code>
                                            </td>
                                            <td><span style={{ color: '#475569', fontWeight: '500' }}>{row.comunicacion}</span></td>
                                            
                                            {/* CANALES 1°, 2°, 3° */}
                                            {row.canales.map((ch, idx) => {
                                                const cfg = row.configs && row.configs[ch];
                                                const isConfigured = ch !== 'none' && cfg && cfg.enabled;
                                                return (
                                                    <td key={idx}>
                                                        <div className="channel-btn-cell">
                                                            <select 
                                                                value={ch} 
                                                                onChange={(e) => handleChannelOrderChange(row.id, idx, e.target.value)}
                                                                style={{ border: 'none', background: 'none', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', color: '#64748b' }}
                                                            >
                                                                <option value="whatsapp">WhatsApp</option>
                                                                <option value="push">Push</option>
                                                                <option value="email">Email</option>
                                                                <option value="none">— Ninguno</option>
                                                            </select>
                                                            {ch !== 'none' && (
                                                                <button 
                                                                    className={`btn-channel-badge ${ch}`}
                                                                    onClick={() => handleOpenChannelModal(row, ch)}
                                                                >
                                                                    <span>{ch === 'whatsapp' ? '💬 WA' : ch === 'push' ? '🔔 Push' : '📧 Email'}</span>
                                                                    <span className="channel-config-status">
                                                                        {isConfigured ? '⚙️ Config.' : '⚠️ Sin config'}
                                                                    </span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}

                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                    <button 
                                                        onClick={() => handleOpenRowEditModal(row)}
                                                        style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.85rem' }}
                                                        title="Editar Regla / Trigger"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteRow(row.id)}
                                                        style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444' }}
                                                        title="Eliminar Evento"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>

                                            <td style={{ textAlign: 'center' }}>
                                                <label className="switch">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={row.enabled} 
                                                        onChange={() => handleToggleMatrixRow(row.id)}
                                                    />
                                                    <span className="slider round"></span>
                                                </label>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MODAL CONFIGURACION GENERAL DE LA REGLA / FILA */}
                    {selectedRowModal.isOpen && (
                        <div className="matrix-modal-backdrop" onClick={() => setSelectedRowModal({ isOpen: false, isNew: false, eventId: null })}>
                            <div className="matrix-modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="matrix-modal-header">
                                    <h3>
                                        <span>⚙️</span>
                                        {selectedRowModal.isNew ? 'Añadir Nuevo Evento / Regla' : `Editar Regla: ${rowEditForm.evento}`}
                                    </h3>
                                    <button 
                                        style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}
                                        onClick={() => setSelectedRowModal({ isOpen: false, isNew: false, eventId: null })}
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="matrix-modal-body">
                                    <div className="form-group">
                                        <label>Nombre del Evento / Escenario:</label>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            placeholder="ej: Recordatorio 7 días, Carrito Abandonado, Hábito Almuerzo"
                                            value={rowEditForm.evento}
                                            onChange={(e) => setRowEditForm(prev => ({ ...prev, evento: e.target.value }))}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div className="form-group">
                                            <label>Estado CRM Asignado:</label>
                                            <select 
                                                className="form-control"
                                                value={rowEditForm.estado_crm || rowEditForm.estado}
                                                onChange={(e) => setRowEditForm(prev => ({ ...prev, estado_crm: e.target.value, estado: e.target.value }))}
                                            >
                                                <option value="TODOS">Todos los Estados</option>
                                                <option value="VISITANTE">Visitante</option>
                                                <option value="REGISTRADO">Registrado</option>
                                                <option value="PRIMER_PEDIDO">Primer Pedido</option>
                                                <option value="CLIENTE_ACTIVO">Cliente Activo</option>
                                                <option value="CLIENTE_FRECUENTE">Cliente Frecuente</option>
                                                <option value="VIP">VIP</option>
                                                <option value="DORMIDO">Dormido</option>
                                                <option value="RECUPERADO">Recuperado</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Tipo de Comunicación:</label>
                                            <input 
                                                type="text"
                                                className="form-control"
                                                placeholder="ej: Adquisición, Recompra, Fidelización"
                                                value={rowEditForm.comunicacion}
                                                onChange={(e) => setRowEditForm(prev => ({ ...prev, comunicacion: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '12px' }}>
                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#0f172a' }}>🎯 Configuración del Disparador (Trigger)</h4>
                                        
                                        <div className="form-group">
                                            <label>Tipo de Disparador:</label>
                                            <select 
                                                className="form-control"
                                                value={rowEditForm.trigger_type}
                                                onChange={(e) => setRowEditForm(prev => ({ ...prev, trigger_type: e.target.value }))}
                                            >
                                                <option value="dias_inactividad">🗓️ Días de Inactividad (Sin comprar)</option>
                                                <option value="minutos_post_entrega">⏱️ Minutos tras Entrega / Cambio Estado</option>
                                                <option value="horario_consumo">⏰ Horario de Consumo Preferido (Habitual)</option>
                                                <option value="frecuencia_pedidos">📊 Frecuencia / Cantidad de Pedidos</option>
                                                <option value="evento_sistema">⚡ Evento del Sistema en Tiempo Real</option>
                                            </select>
                                        </div>

                                        {/* PARAMETROS DINAMICOS DEL TRIGGER */}
                                        {rowEditForm.trigger_type === 'dias_inactividad' && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Días transcurridos sin pedir:</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input 
                                                        type="number" 
                                                        className="form-control" 
                                                        min="1"
                                                        value={rowEditForm.trigger_config?.dias || 7}
                                                        onChange={(e) => setRowEditForm(prev => ({ 
                                                            ...prev, 
                                                            trigger_config: { ...prev.trigger_config, dias: parseInt(e.target.value) || 1 } 
                                                        }))}
                                                    />
                                                    <span>días</span>
                                                </div>
                                            </div>
                                        )}

                                        {rowEditForm.trigger_type === 'minutos_post_entrega' && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Minutos transcurridos tras entrega o demora:</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input 
                                                        type="number" 
                                                        className="form-control" 
                                                        min="1"
                                                        value={rowEditForm.trigger_config?.minutos || 30}
                                                        onChange={(e) => setRowEditForm(prev => ({ 
                                                            ...prev, 
                                                            trigger_config: { ...prev.trigger_config, minutos: parseInt(e.target.value) || 1 } 
                                                        }))}
                                                    />
                                                    <span>minutos</span>
                                                </div>
                                            </div>
                                        )}

                                        {rowEditForm.trigger_type === 'horario_consumo' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label>Hora de Envio Recomendada:</label>
                                                    <input 
                                                        type="text" 
                                                        className="form-control" 
                                                        placeholder="ej: 12:30 o 20:00"
                                                        value={rowEditForm.trigger_config?.hora_envio || '12:30'}
                                                        onChange={(e) => setRowEditForm(prev => ({ 
                                                            ...prev, 
                                                            trigger_config: { ...prev.trigger_config, hora_envio: e.target.value } 
                                                        }))}
                                                    />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label>Franja Horaria:</label>
                                                    <select 
                                                        className="form-control"
                                                        value={rowEditForm.trigger_config?.franja || 'Almuerzo'}
                                                        onChange={(e) => setRowEditForm(prev => ({ 
                                                            ...prev, 
                                                            trigger_config: { ...prev.trigger_config, franja: e.target.value } 
                                                        }))}
                                                    >
                                                        <option value="Almuerzo">Almuerzo (12-14hs)</option>
                                                        <option value="Cena">Cena (20-23hs)</option>
                                                        <option value="Merienda">Merienda (16-19hs)</option>
                                                        <option value="Finde">Fin de Semana</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {rowEditForm.trigger_type === 'frecuencia_pedidos' && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Cantidad de Pedidos acumulados:</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input 
                                                        type="number" 
                                                        className="form-control" 
                                                        min="1"
                                                        value={rowEditForm.trigger_config?.pedidos_count || 3}
                                                        onChange={(e) => setRowEditForm(prev => ({ 
                                                            ...prev, 
                                                            trigger_config: { ...prev.trigger_config, pedidos_count: parseInt(e.target.value) || 1 } 
                                                        }))}
                                                    />
                                                    <span>pedidos</span>
                                                </div>
                                            </div>
                                        )}

                                        {rowEditForm.trigger_type === 'evento_sistema' && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>Identificador del Evento en Tiempo Real:</label>
                                                <select 
                                                    className="form-control"
                                                    value={['USUARIO_REGISTRADO','VISITA_SIN_COMPRA','CARRITO_ABANDONADO','PEDIDO_NO_PAGADO','PEDIDO_RECHAZADO_FALTA_PAGO','sin_repartidores','PEDIDO_RECHAZADO_SIN_REPARTIDOR_2','PEDIDO_ACEPTADO','PEDIDO_RETIRADO','REPARTIDOR_CERCA','ESPERANDO_REPARTIDOR','REPARTIDOR_ASIGNADO','PEDIDO_ENTREGADO'].includes(rowEditForm.trigger_config?.evento_key) ? rowEditForm.trigger_config?.evento_key : 'CUSTOM'}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setRowEditForm(prev => ({ 
                                                            ...prev, 
                                                            trigger_config: { ...prev.trigger_config, evento_key: val === 'CUSTOM' ? (prev.trigger_config?.evento_key || 'MI_EVENTO_CUSTOM') : val } 
                                                        }));
                                                    }}
                                                >
                                                    <option value="USUARIO_REGISTRADO">USUARIO_REGISTRADO (Nuevo registro)</option>
                                                    <option value="VISITA_SIN_COMPRA">VISITA_SIN_COMPRA (Navegó sin comprar)</option>
                                                    <option value="CARRITO_ABANDONADO">CARRITO_ABANDONADO (Checkout no enviado)</option>
                                                    <option value="PEDIDO_NO_PAGADO">PEDIDO_NO_PAGADO (Pago pendiente)</option>
                                                    <option value="PEDIDO_RECHAZADO_FALTA_PAGO">PEDIDO_RECHAZADO_FALTA_PAGO (Pago rechazado/fallido)</option>
                                                    <option value="sin_repartidores">sin_repartidores (1. Aviso Sin Repartidores)</option>
                                                    <option value="PEDIDO_RECHAZADO_SIN_REPARTIDOR_2">PEDIDO_RECHAZADO_SIN_REPARTIDOR_2 (2. Refuerzo 5 min Sin Repartidor)</option>
                                                    <option value="PEDIDO_ACEPTADO">PEDIDO_ACEPTADO (En preparación)</option>
                                                    <option value="PEDIDO_RETIRADO">PEDIDO_RETIRADO (Retirado por repartidor)</option>
                                                    <option value="REPARTIDOR_CERCA">REPARTIDOR_CERCA (Repartidor a 500m)</option>
                                                    <option value="ESPERANDO_REPARTIDOR">ESPERANDO_REPARTIDOR (Demora asignación)</option>
                                                    <option value="REPARTIDOR_ASIGNADO">REPARTIDOR_ASIGNADO (En camino)</option>
                                                    <option value="PEDIDO_ENTREGADO">PEDIDO_ENTREGADO (Pedido recibido)</option>
                                                    <option value="CUSTOM">✨ Disparador Personalizado (Escribir Clave Manual...)</option>
                                                </select>

                                                {(!['USUARIO_REGISTRADO','VISITA_SIN_COMPRA','CARRITO_ABANDONADO','PEDIDO_NO_PAGADO','PEDIDO_RECHAZADO_FALTA_PAGO','sin_repartidores','PEDIDO_RECHAZADO_SIN_REPARTIDOR_2','PEDIDO_ACEPTADO','PEDIDO_RETIRADO','REPARTIDOR_CERCA','ESPERANDO_REPARTIDOR','REPARTIDOR_ASIGNADO','PEDIDO_ENTREGADO'].includes(rowEditForm.trigger_config?.evento_key)) && (
                                                    <div style={{ marginTop: '10px' }}>
                                                        <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>Clave de Evento Personalizada:</label>
                                                        <input 
                                                            type="text" 
                                                            className="form-control"
                                                            placeholder="ej: MI_EVENTO_CUSTOM, CUMPLEANOS_CLIENTE, REINTEGRO_WALLET"
                                                            value={rowEditForm.trigger_config?.evento_key || ''}
                                                            onChange={(e) => {
                                                                const cleanKey = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                                                                setRowEditForm(prev => ({ 
                                                                    ...prev, 
                                                                    trigger_config: { ...prev.trigger_config, evento_key: cleanKey } 
                                                                }));
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="matrix-modal-footer">
                                    <button className="btn btn-outline" onClick={() => setSelectedRowModal({ isOpen: false, isNew: false, eventId: null })}>
                                        Cancelar
                                    </button>
                                    <button className="btn btn-primary" onClick={handleSaveRowConfig}>
                                        {selectedRowModal.isNew ? 'Añadir Evento' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL CONFIGURACION DE CANAL INDIVIDUAL */}
                    {selectedChannelModal.isOpen && (
                        <div className="matrix-modal-backdrop" onClick={() => setSelectedChannelModal({ isOpen: false, eventId: null, channel: null, eventName: '' })}>
                            <div className="matrix-modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="matrix-modal-header">
                                    <h3>
                                        <span>{selectedChannelModal.channel === 'whatsapp' ? '💬' : selectedChannelModal.channel === 'push' ? '🔔' : '📧'}</span>
                                        Configurar Canal {selectedChannelModal.channel.toUpperCase()} - {selectedChannelModal.eventName}
                                    </h3>
                                    <button 
                                        style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}
                                        onClick={() => setSelectedChannelModal({ isOpen: false, eventId: null, channel: null, eventName: '' })}
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="matrix-modal-body">
                                    <div className="form-group" style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={channelEditForm.enabled} 
                                                onChange={(e) => setChannelEditForm(prev => ({ ...prev, enabled: e.target.checked }))}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            Canal Habilitado para este evento
                                        </label>
                                    </div>

                                    {/* CONFIG WHATSAPP */}
                                    {selectedChannelModal.channel === 'whatsapp' && (
                                        <div>
                                            <div className="form-group">
                                                <label>Nombre de la Plantilla de Meta (HSM):</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="ej: reactivacion_carrito_1"
                                                    value={channelEditForm.template_name}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, template_name: e.target.value }))}
                                                />
                                            </div>

                                            {/* CONSTRUCTOR DE ENLACE META CON UTMS */}
                                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '16px' }}>
                                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                                                    🔗 Enlace UTM Formateado para Meta Business Manager:
                                                </label>

                                                {/* SELECCIONADOR DE RAMA / RUTA DE DESTINO INSIDE THE PANEL */}
                                                <div className="form-group" style={{ marginBottom: '10px' }}>
                                                    <label style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#334155' }}>🌱 Seleccionar Ruta / Rama de Destino en la App:</label>
                                                    <select 
                                                        className="form-control"
                                                        style={{ fontSize: '0.85rem' }}
                                                        value={['/pedir', '/mis-pedidos', '/checkout', '/cupones', '/perfil', '/locales'].includes(channelEditForm.url || '/pedir') ? (channelEditForm.url || '/pedir') : 'CUSTOM'}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setChannelEditForm(prev => ({
                                                                ...prev,
                                                                url: val === 'CUSTOM' ? (prev.url || '/pedir') : val
                                                            }));
                                                        }}
                                                    >
                                                        <option value="/pedir">🛒 /pedir (Catálogo & Inicio de Pedidos)</option>
                                                        <option value="/mis-pedidos">📋 /mis-pedidos (Seguimiento de Pedidos)</option>
                                                        <option value="/checkout">💳 /checkout (Pantalla de Pago)</option>
                                                        <option value="/cupones">🎟️ /cupones (Cupones y Descuentos)</option>
                                                        <option value="/perfil">👤 /perfil (Mi Cuenta y Datos)</option>
                                                        <option value="/locales">🏪 /locales (Lista de Comercios)</option>
                                                        <option value="CUSTOM">✏️ Escribir Ruta Personalizada...</option>
                                                    </select>
                                                    {(!['/pedir', '/mis-pedidos', '/checkout', '/cupones', '/perfil', '/locales'].includes(channelEditForm.url || '/pedir')) && (
                                                        <input 
                                                            type="text" 
                                                            className="form-control" 
                                                            style={{ marginTop: '6px', fontSize: '0.85rem' }}
                                                            placeholder="ej: /local/123 o /categoria/burgers"
                                                            value={channelEditForm.url || ''}
                                                            onChange={(e) => setChannelEditForm(prev => ({ ...prev, url: e.target.value }))}
                                                        />
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input 
                                                        type="text"
                                                        readOnly
                                                        className="form-control"
                                                        style={{ fontSize: '0.8rem', fontFamily: 'monospace', background: '#ffffff', color: '#0284c7', fontWeight: 'bold' }}
                                                        value={`https://wepi.com.ar${channelEditForm.url || '/pedir'}?utm_source=whatsapp&utm_medium=hsm&utm_campaign=${channelEditForm.template_name || 'plantilla_meta'}`}
                                                    />
                                                    <button 
                                                        type="button"
                                                        className="btn btn-outline"
                                                        style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '0.8rem' }}
                                                        onClick={() => {
                                                            const url = `https://wepi.com.ar${channelEditForm.url || '/pedir'}?utm_source=whatsapp&utm_medium=hsm&utm_campaign=${channelEditForm.template_name || 'plantilla_meta'}`;
                                                            navigator.clipboard.writeText(url);
                                                            toast.success("¡Enlace copiado! Pégalo en el botón de acción al crear la plantilla en Meta.");
                                                        }}
                                                    >
                                                        📋 Copiar Enlace Meta
                                                    </button>
                                                </div>
                                                <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                                    💡 Copia este enlace y configúralo en el botón de la plantilla dentro del panel de Meta. Dirigirá al cliente a <code>{channelEditForm.url || '/pedir'}</code> abriendo la App nativa.
                                                </p>
                                            </div>

                                            <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bbf7d0', fontSize: '0.83rem', color: '#166534' }}>
                                                🔒 <strong>Nota de Seguridad WhatsApp API:</strong> Este mensaje se enviará ÚNICAMENTE a los usuarios que hayan concedido su consentimiento Opt-in previo.
                                            </div>
                                        </div>
                                    )}

                                    {/* CONFIG PUSH */}
                                    {selectedChannelModal.channel === 'push' && (
                                        <div>
                                            <div className="form-group">
                                                <label>Título de la Notificación Push:</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="ej: ¡Olvidaste tu carrito!"
                                                    value={channelEditForm.title}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, title: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Cuerpo del Mensaje:</label>
                                                <textarea 
                                                    className="form-control" 
                                                    rows={3}
                                                    placeholder="ej: Tus hamburguesas favoritas están esperando por ti."
                                                    value={channelEditForm.body}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, body: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Enlace / Ruta de Destino en la App:</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="ej: /pedir o /checkout"
                                                    value={channelEditForm.url}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, url: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* CONFIG EMAIL */}
                                    {selectedChannelModal.channel === 'email' && (
                                        <div>
                                            <div className="form-group">
                                                <label>Asunto del Email:</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="ej: Te extrañamos en Wepi 🍔"
                                                    value={channelEditForm.subject}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, subject: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Cuerpo del Correo (Usa [Nombre] para personalizar):</label>
                                                <textarea 
                                                    className="form-control" 
                                                    rows={4}
                                                    placeholder="Hola [Nombre], te dejamos este beneficio..."
                                                    value={channelEditForm.body}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, body: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Enlace del Botón de Acción:</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="https://wepi.com.ar/pedir"
                                                    value={channelEditForm.url}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, url: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>URL de Logo en Encabezado (Opcional):</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="https://i.postimg.cc/...png"
                                                    value={channelEditForm.logo_url}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, logo_url: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="matrix-modal-footer">
                                    <button className="btn btn-outline" onClick={() => setSelectedChannelModal({ isOpen: false, eventId: null, channel: null, eventName: '' })}>
                                        Cancelar
                                    </button>
                                    <button className="btn btn-primary" onClick={handleSaveChannelConfig}>
                                        Guardar Canal
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: MOTOR DE HÁBITOS */}
            {activeTab === 'habitos' && (
                <div className="tab-pane animate-fade-in">
                    <div className="matrix-header-info">
                        <div>
                            <h2>🧠 Motor de Hábitos de WEPI (Frecuencia de Consumo)</h2>
                            <p>Estrategia de posicionamiento mental ("Tengo hambre ➔ WEPI") mediante Jobs horarios en momentos clave de consumo.</p>
                        </div>
                        <button className="btn-launch" onClick={handleSaveEntireHabitsConfig} disabled={savingHabits}>
                            💾 {savingHabits ? 'Guardando...' : 'Guardar Motor de Hábitos'}
                        </button>
                    </div>

                    {/* BLOQUE DE CONFIGURACION GLOBAL DE FRECUENCIA Y CANALES */}
                    <div className="habit-global-card" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🎛️ Reglas Globales de Frecuencia y Prioridad de App
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontWeight: 'bold' }}>Frecuencia Máxima Semanal Total por Usuario:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input 
                                        type="number" 
                                        className="form-control"
                                        min="1" max="7"
                                        value={habitsConfig.global_settings?.max_weekly_per_user || 3}
                                        onChange={(e) => handleUpdateHabitsGlobalSettings('max_weekly_per_user', parseInt(e.target.value) || 1)}
                                    />
                                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>mensajes/semana max</span>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontWeight: 'bold' }}>Frecuencia Máxima Semanal por WhatsApp (WA):</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input 
                                        type="number" 
                                        className="form-control"
                                        min="1" max="7"
                                        value={habitsConfig.global_settings?.max_weekly_whatsapp || 1}
                                        onChange={(e) => handleUpdateHabitsGlobalSettings('max_weekly_whatsapp', parseInt(e.target.value) || 1)}
                                    />
                                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>envío WA/semana max</span>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontWeight: 'bold' }}>Plantilla WA Invitación "Descarga la App":</label>
                                <input 
                                    type="text" 
                                    className="form-control"
                                    placeholder="ej: instala_app"
                                    value={habitsConfig.global_settings?.wa_invite_app_template || 'instala_app'}
                                    onChange={(e) => handleUpdateHabitsGlobalSettings('wa_invite_app_template', e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #cbd5e1' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '600', color: '#0f172a' }}>
                                <input 
                                    type="checkbox"
                                    checked={habitsConfig.global_settings?.prioritize_push_app !== false}
                                    onChange={(e) => handleUpdateHabitsGlobalSettings('prioritize_push_app', e.target.checked)}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                📱 Priorizar Push App SIEMPRE si el usuario la tiene instalada
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '600', color: '#0f172a' }}>
                                <input 
                                    type="checkbox"
                                    checked={habitsConfig.global_settings?.wa_invite_app_enabled !== false}
                                    onChange={(e) => handleUpdateHabitsGlobalSettings('wa_invite_app_enabled', e.target.checked)}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                💬 Si no tiene Push, enviar WA "Instala App" (1 vez/semana max)
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '600', color: '#0f172a' }}>
                                <input 
                                    type="checkbox"
                                    checked={habitsConfig.global_settings?.predictive_habits_enabled !== false}
                                    onChange={(e) => handleUpdateHabitsGlobalSettings('predictive_habits_enabled', e.target.checked)}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                🔮 Reemplazar por hábito detectado (ej: Viernes 21hs Hamburguesas)
                            </label>
                        </div>
                    </div>

                    {/* TABLA DE MOMENTOS DE CONSUMO (CRON SLOTS) */}
                    <div className="matrix-table-card">
                        <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>⏰ Momentos del Día (Cron Jobs Horarios)</h3>
                        </div>
                        <div className="matrix-table-responsive">
                            <table className="matrix-table">
                                <thead>
                                    <tr>
                                        <th>Momento de Consumo</th>
                                        <th>Hora de Ejecución</th>
                                        <th>🥇 1° Canal</th>
                                        <th>🥈 2° Canal</th>
                                        <th>🥉 3° Canal</th>
                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(habitsConfig.moments || []).map(moment => (
                                        <tr key={moment.id} className={moment.enabled ? '' : 'row-disabled'}>
                                            <td style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>{moment.nombre}</td>
                                            <td>
                                                <input 
                                                    type="text" 
                                                    value={moment.hora} 
                                                    onChange={(e) => handleHabitMomentTimeChange(moment.id, e.target.value)}
                                                    style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', textAlign: 'center' }}
                                                />
                                            </td>

                                            {/* CANALES 1°, 2°, 3° DE HÁBITOS */}
                                            {moment.canales.map((ch, idx) => {
                                                const cfg = moment.configs && moment.configs[ch];
                                                const isConfigured = ch !== 'none' && cfg && cfg.enabled;
                                                return (
                                                    <td key={idx}>
                                                        <div className="channel-btn-cell">
                                                            <select 
                                                                value={ch} 
                                                                onChange={(e) => handleHabitMomentChannelOrderChange(moment.id, idx, e.target.value)}
                                                                style={{ border: 'none', background: 'none', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', color: '#64748b' }}
                                                            >
                                                                <option value="push">Push</option>
                                                                <option value="whatsapp">WhatsApp</option>
                                                                <option value="email">Email</option>
                                                                <option value="none">— Ninguno</option>
                                                            </select>
                                                            {ch !== 'none' && (
                                                                <button 
                                                                    className={`btn-channel-badge ${ch}`}
                                                                    onClick={() => handleOpenHabitChannelModal(moment, ch)}
                                                                >
                                                                    <span>{ch === 'whatsapp' ? '💬 WA' : ch === 'push' ? '🔔 Push' : '📧 Email'}</span>
                                                                    <span className="channel-config-status">
                                                                        {isConfigured ? '⚙️ Config.' : '⚠️ Sin config'}
                                                                    </span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}

                                            <td style={{ textAlign: 'center' }}>
                                                <label className="switch">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={moment.enabled} 
                                                        onChange={() => handleToggleHabitMoment(moment.id)}
                                                    />
                                                    <span className="slider round"></span>
                                                </label>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MODAL CONFIGURACION DE CANAL PARA MOMENTO DE HABITO */}
                    {selectedHabitChannelModal.isOpen && (
                        <div className="matrix-modal-backdrop" onClick={() => setSelectedHabitChannelModal({ isOpen: false, momentId: null, channel: null, momentName: '' })}>
                            <div className="matrix-modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="matrix-modal-header">
                                    <h3>
                                        <span>{selectedHabitChannelModal.channel === 'whatsapp' ? '💬' : selectedHabitChannelModal.channel === 'push' ? '🔔' : '📧'}</span>
                                        Configurar Canal {selectedHabitChannelModal.channel.toUpperCase()} - {selectedHabitChannelModal.momentName}
                                    </h3>
                                    <button 
                                        style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}
                                        onClick={() => setSelectedHabitChannelModal({ isOpen: false, momentId: null, channel: null, momentName: '' })}
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="matrix-modal-body">
                                    <div className="form-group" style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={channelEditForm.enabled} 
                                                onChange={(e) => setChannelEditForm(prev => ({ ...prev, enabled: e.target.checked }))}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            Canal Habilitado para este momento de consumo
                                        </label>
                                    </div>

                                    {/* CONFIG WHATSAPP */}
                                    {selectedHabitChannelModal.channel === 'whatsapp' && (
                                        <div>
                                            <div className="form-group">
                                                <label>Nombre de la Plantilla de Meta (HSM):</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="ej: almuerzo_sugerencia"
                                                    value={channelEditForm.template_name}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, template_name: e.target.value }))}
                                                />
                                            </div>

                                            {/* CONSTRUCTOR DE ENLACE META CON UTMS */}
                                            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '14px' }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                                                    🔗 Enlace UTM Formateado para Meta Business Manager:
                                                </label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input 
                                                        type="text"
                                                        readOnly
                                                        className="form-control"
                                                        style={{ fontSize: '0.8rem', fontFamily: 'monospace', background: '#ffffff', color: '#0284c7' }}
                                                        value={`https://wepi.com.ar/pedir?utm_source=whatsapp&utm_medium=hsm&utm_campaign=${channelEditForm.template_name || 'plantilla_meta'}`}
                                                    />
                                                    <button 
                                                        type="button"
                                                        className="btn btn-outline"
                                                        style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '0.8rem' }}
                                                        onClick={() => {
                                                            const url = `https://wepi.com.ar/pedir?utm_source=whatsapp&utm_medium=hsm&utm_campaign=${channelEditForm.template_name || 'plantilla_meta'}`;
                                                            navigator.clipboard.writeText(url);
                                                            toast.success("¡Enlace copiado! Pégalo en el botón de acción al crear la plantilla en Meta.");
                                                        }}
                                                    >
                                                        📋 Copiar Enlace Meta
                                                    </button>
                                                </div>
                                                <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                                    💡 Copia este enlace y configúralo en el botón de la plantilla dentro del panel de Meta. Registrará las ventas hechas en las siguientes 24 hs.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* CONFIG PUSH */}
                                    {selectedHabitChannelModal.channel === 'push' && (
                                        <div>
                                            <div className="form-group">
                                                <label>Título de la Notificación Push de Hábito:</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="ej: 🍔 ¿Qué vas a almorzar hoy?"
                                                    value={channelEditForm.title}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, title: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Cuerpo del Mensaje de Hábito:</label>
                                                <textarea 
                                                    className="form-control" 
                                                    rows={3}
                                                    placeholder="ej: Tu comida favorita lista para ser entregada."
                                                    value={channelEditForm.body}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, body: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Ruta de Destino en la App:</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="/pedir"
                                                    value={channelEditForm.url}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, url: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* CONFIG EMAIL */}
                                    {selectedHabitChannelModal.channel === 'email' && (
                                        <div>
                                            <div className="form-group">
                                                <label>Asunto del Email:</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="ej: ¿Con hambre? Descubre los menúes de hoy 🍽️"
                                                    value={channelEditForm.subject}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, subject: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Cuerpo del Correo:</label>
                                                <textarea 
                                                    className="form-control" 
                                                    rows={4}
                                                    placeholder="Hola [Nombre]..."
                                                    value={channelEditForm.body}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, body: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Enlace del Botón:</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="https://wepi.com.ar/pedir"
                                                    value={channelEditForm.url}
                                                    onChange={(e) => setChannelEditForm(prev => ({ ...prev, url: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="matrix-modal-footer">
                                    <button className="btn btn-outline" onClick={() => setSelectedHabitChannelModal({ isOpen: false, momentId: null, channel: null, momentName: '' })}>
                                        Cancelar
                                    </button>
                                    <button className="btn btn-primary" onClick={handleSaveHabitChannelConfig}>
                                        Guardar Canal
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: CAMPAÑAS */}
            {activeTab === 'campanas' && (
                <div className="tab-pane">
                    <div className="campaign-workspace">
                        {/* Setup Form */}
                        <div className="campaign-setup-card">
                            <h2>Crear Nueva Campaña</h2>
                            <div className="form-group">
                                <label>Nombre de la Campaña</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: Promo Oberá Helado Finde" 
                                    value={campaignForm.nombre}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, nombre: e.target.value }))}
                                />
                            </div>

                            <h3>Segmentación de Audiencia (Filtros)</h3>
                            <div className="filters-setup-grid">
                                <div className="form-group">
                                    <label>Ciudad</label>
                                    <select 
                                        value={campaignForm.filtros.ciudad}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, ciudad: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Todas las ciudades</option>
                                        <option value="Santo Tomé">Santo Tomé</option>
                                        <option value="Oberá">Oberá</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Estado CRM</label>
                                    <select 
                                        value={campaignForm.filtros.estado_crm}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, estado_crm: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Todos los estados</option>
                                        <option value="VISITANTE">Visitante</option>
                                        <option value="REGISTRADO">Registrado</option>
                                        <option value="PRIMER_PEDIDO">Primer Pedido</option>
                                        <option value="CLIENTE_ACTIVO">Cliente Activo</option>
                                        <option value="CLIENTE_FRECUENTE">Cliente Frecuente</option>
                                        <option value="VIP">VIP</option>
                                        <option value="DORMIDO">Dormido</option>
                                        <option value="RECUPERADO">Recuperado</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Etiqueta requerida</label>
                                    <select 
                                        value={campaignForm.filtros.tag}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, tag: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Cualquier etiqueta</option>
                                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Pedidos Mínimos</label>
                                    <input 
                                        type="number" 
                                        value={campaignForm.filtros.pedidos_min}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, pedidos_min: parseInt(e.target.value) || 0 } 
                                        }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Días Inactividad Mín.</label>
                                    <input 
                                        type="number" 
                                        value={campaignForm.filtros.dias_inactivo_min}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, dias_inactivo_min: parseInt(e.target.value) || 0 } 
                                        }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Score Wepi Mínimo</label>
                                    <input 
                                        type="number" 
                                        value={campaignForm.filtros.score_min}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, score_min: parseInt(e.target.value) || 0 } 
                                        }))}
                                    />
                                </div>
                            </div>

                            <h3>Configuración del Canal y Mensaje</h3>
                            <div className="form-group">
                                <label>Canal de Comunicación</label>
                                <select 
                                    value={campaignForm.canal}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, canal: e.target.value }))}
                                >
                                    <option value="whatsapp">💬 WhatsApp (Plantilla HSM Meta Aprobada)</option>
                                    <option value="push">🔔 Push Notification App (OneSignal con WA fallback)</option>
                                    <option value="email">📧 Email Marketing</option>
                                </select>
                            </div>

                            {/* CAMPOS ESPECIFICOS PARA WHATSAPP META HSM */}
                            {campaignForm.canal === 'whatsapp' && (
                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '16px' }}>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 'bold' }}>Nombre de la Plantilla de Meta (HSM):</label>
                                        <input 
                                            type="text"
                                            className="form-control"
                                            placeholder="ej: promo_obera_fin_semana"
                                            value={campaignForm.template_name}
                                            onChange={(e) => setCampaignForm(prev => ({ ...prev, template_name: e.target.value }))}
                                        />
                                    </div>

                                    {/* CONSTRUCTOR DE ENLACE META CON UTMS */}
                                    <div style={{ marginTop: '12px' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                                            🔗 Enlace UTM Formateado para Meta Business Manager:
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input 
                                                type="text"
                                                readOnly
                                                className="form-control"
                                                style={{ fontSize: '0.8rem', fontFamily: 'monospace', background: '#ffffff', color: '#0284c7' }}
                                                value={`https://wepi.com.ar/pedir?utm_source=whatsapp&utm_medium=hsm&utm_campaign=${campaignForm.template_name || campaignForm.nombre || 'campana_wa'}`}
                                            />
                                            <button 
                                                type="button"
                                                className="btn btn-outline"
                                                style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '0.8rem' }}
                                                onClick={() => {
                                                    const url = `https://wepi.com.ar/pedir?utm_source=whatsapp&utm_medium=hsm&utm_campaign=${campaignForm.template_name || campaignForm.nombre || 'campana_wa'}`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("¡Enlace copiado! Pégalo en el botón de acción al crear la plantilla en Meta.");
                                                }}
                                            >
                                                📋 Copiar Enlace Meta
                                            </button>
                                        </div>
                                        <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                            💡 Las plantillas de WhatsApp no permiten texto libre directo. Copia este enlace en el botón de la plantilla dentro del panel de Meta.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* CAMPOS ESPECIFICOS PARA PUSH APP */}
                            {campaignForm.canal === 'push' && (
                                <div>
                                    <div className="form-group">
                                        <label>Cuerpo de la Notificación Push (Usa <code>[Nombre]</code> para personalizar):</label>
                                        <textarea 
                                            rows="4" 
                                            placeholder="¡Hola [Nombre]! Te extrañamos en Wepi. Te dejamos un regalo especial..."
                                            value={campaignForm.mensaje}
                                            onChange={(e) => setCampaignForm(prev => ({ ...prev, mensaje: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* CAMPOS ESPECIFICOS PARA EMAIL */}
                            {campaignForm.canal === 'email' && (
                                <div>
                                    <div className="form-group">
                                        <label>Asunto del Email:</label>
                                        <input 
                                            type="text"
                                            className="form-control"
                                            placeholder="ej: ¡Te extrañamos en Wepi! Tu regalo de bienvenida 🎁"
                                            value={campaignForm.asunto}
                                            onChange={(e) => setCampaignForm(prev => ({ ...prev, asunto: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Cuerpo del Correo HTML/Texto (Usa <code>[Nombre]</code> para personalizar):</label>
                                        <textarea 
                                            rows="4" 
                                            placeholder="Hola [Nombre]..."
                                            value={campaignForm.mensaje}
                                            onChange={(e) => setCampaignForm(prev => ({ ...prev, mensaje: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Programar Fecha y Hora (Dejar vacío para enviar de inmediato)</label>
                                <input 
                                    type="datetime-local" 
                                    value={campaignForm.fecha_programada}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, fecha_programada: e.target.value }))}
                                />
                            </div>

                            <div className="audience-estimation">
                                <p>Usuarios seleccionados para envío: <strong>{targetedCampaignUsersCount}</strong></p>
                            </div>

                            <button className="btn-launch" onClick={handleLaunchCampaign}>
                                {campaignForm.fecha_programada ? '📅 Programar Campaña' : '🚀 Enviar Campaña Ahora'}
                            </button>
                        </div>

                        {/* History list with execution metrics */}
                        <div className="campaign-history-card">
                            <h2>Campañas Lanzadas y Métricas de Despacho</h2>
                            <div className="campaigns-list">
                                {campaigns.map(camp => {
                                    const total = camp.total_audiencia || 0;
                                    const success = camp.enviados_exito || 0;
                                    const failed = camp.fallidos || 0;
                                    const rate = total > 0 ? ((success / total) * 100).toFixed(1) : '100.0';
                                    return (
                                        <div key={camp.id} className="campaign-item">
                                            <div className="camp-header">
                                                <h4>{camp.nombre}</h4>
                                                <button className="btn-small btn-delete" onClick={() => handleDeleteCampaign(camp.id)}>Eliminar</button>
                                            </div>
                                            <p className="desc">{camp.mensaje || `Plantilla Meta: ${camp.template_name}`}</p>
                                            
                                            {/* METRICAS DE DESPACHO Y MONITOREO */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '8px', margin: '10px 0', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                                                <div>
                                                    <span style={{ color: '#64748b', display: 'block' }}>Audiencia Objetivo:</span>
                                                    <strong>{total} usuarios</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#166534', display: 'block' }}>Enviados / Éxito:</span>
                                                    <strong style={{ color: '#16a34a' }}>{success} exitosos</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#991b1b', display: 'block' }}>Fallidos / Omitidos:</span>
                                                    <strong style={{ color: '#dc2626' }}>{failed} sin envío</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#0369a1', display: 'block' }}>Tasa Despacho:</span>
                                                    <strong style={{ color: '#0284c7' }}>{rate} %</strong>
                                                </div>
                                            </div>

                                            <div className="meta">
                                                <span>Canal: <strong style={{ textTransform: 'uppercase' }}>{camp.canal === 'whatsapp' ? '💬 WA Meta' : camp.canal === 'push' ? '🔔 Push' : '📧 Email'}</strong></span>
                                                <span className={`status-badge ${camp.estado?.toLowerCase()}`}>{camp.estado}</span>
                                                {camp.fecha_programada && <span>Programada: {formatDateStr(camp.fecha_programada)}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                                {campaigns.length === 0 && <p className="empty">No hay registro de campañas anteriores.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: RETENCION */}
            {activeTab === 'retencion' && (
                <div className="tab-pane">
                    <div className="retention-info-box">
                        <h2>Embudo de Retención e Inactividad</h2>
                        <p>Visualiza segmentos de clientes dormidos de forma rápida, evalúa tasas de conversión de recuperación y realiza acciones masivas.</p>
                    </div>

                    <div className="retention-cohorts-container">
                        {retentionCohorts.map(coh => (
                            <div key={coh.id} className="cohort-row">
                                <div className="cohort-meta">
                                    <h3>{coh.label}</h3>
                                    <span>Clientes: <strong>{coh.count}</strong></span>
                                </div>
                                <div className="cohort-stats">
                                    <div className="cohort-stat-box">
                                        <span>Mensajes enviados</span>
                                        <strong>{coh.messagesSent}</strong>
                                    </div>
                                    <div className="cohort-stat-box">
                                        <span>Tasa de Recuperación</span>
                                        <strong style={{ color: Number(coh.rate) > 0 ? '#10b981' : '#64748b' }}>{coh.rate}%</strong>
                                    </div>
                                </div>
                                <div className="cohort-actions">
                                    <button className="btn-cohort secondary" onClick={() => handleFilterCohort(coh.id)}>
                                        🔍 Ver Clientes
                                    </button>
                                    <button className="btn-cohort" onClick={() => handlePrepopulateCohortCampaign(coh.id)}>
                                        ✉️ Alertar Segmento
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: CONFIGURACION */}
            {activeTab === 'configuracion' && (
                <div className="tab-pane">
                    <div className="config-grid">
                        {/* Dynamic Tags setup */}
                        <div className="config-card">
                            <h2>Administrador de Etiquetas (Tags)</h2>
                            <p className="desc">Las etiquetas clasifican los gustos, horarios y ubicaciones de tus clientes de forma dinámica.</p>
                            
                            <div className="add-tag-form">
                                <input 
                                    type="text" 
                                    placeholder="ID única (Ej: SANTO_TOME, VEGANO)" 
                                    value={newTagIdInput}
                                    onChange={(e) => setNewTagIdInput(e.target.value)}
                                />
                                <input 
                                    type="text" 
                                    placeholder="Nombre legible (Ej: Santo Tomé, Vegano)" 
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value)}
                                />
                                <button className="btn-save" onClick={handleCreateTag}>Registrar Etiqueta</button>
                            </div>

                            <div className="tags-management-list">
                                {tags.map(t => (
                                    <div key={t.id} className="tag-mgmt-item">
                                        <span><strong>{t.name}</strong> (<code>{t.id}</code>)</span>
                                        <button className="btn-small btn-delete" onClick={() => handleDeleteTag(t.id)}>Eliminar</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Score Weights config */}
                        <div className="config-card">
                            <h2>Pesos del Score Wepi</h2>
                            <p className="desc">Ajusta los puntos asignados a las acciones de los usuarios para el cálculo de su fidelización.</p>

                            <div className="score-weights-form">
                                {scoreConfig.map(cfg => (
                                    <div key={cfg.id} className="score-weight-row">
                                        <label>{cfg.nombre} (<code>{cfg.id}</code>)</label>
                                        <input 
                                            type="number" 
                                            value={cfg.puntos}
                                            onChange={(e) => handleUpdateScoreWeight(cfg.id, e.target.value)}
                                        />
                                    </div>
                                ))}
                                <button className="btn-save-weights" onClick={handleSaveScoreWeights}>
                                    💾 Guardar Configuraciones del Score
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* USER DETAIL MODAL (FICHA DEL CLIENTE) */}
            {selectedUserDetail && (
                <div className="crm-modal-overlay" onClick={() => setSelectedUserDetail(null)}>
                    <div className="crm-modal-content user-ficha" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Ficha de Cliente: {selectedUserDetail.nombre || 'Sin nombre'}</h2>
                            <button className="close-btn" onClick={() => setSelectedUserDetail(null)}>&times;</button>
                        </div>
                        <div className="modal-body-split">
                            {/* Profile details */}
                            <div className="profile-details-column">
                                <div className="avatar-header">
                                    <div className="avatar">{(selectedUserDetail.nombre || 'U').substring(0, 1)}</div>
                                    <div className="sub">
                                        <span className={`badge-crm state-${(selectedUserDetail.estado_crm || 'REGISTRADO').toLowerCase()}`}>
                                            {selectedUserDetail.estado_crm || 'REGISTRADO'}
                                        </span>
                                        <span className="badge-score">{selectedUserDetail.wepi_score || 0} pts</span>
                                    </div>
                                </div>

                                <div className="details-info-list">
                                    <p><strong>Teléfono:</strong> {selectedUserDetail.telefono || '-'}</p>
                                    <p><strong>Email:</strong> {selectedUserDetail.email || '-'}</p>
                                    <p><strong>Ciudad:</strong> {selectedUserDetail.ciudad || 'Santo Tomé'}</p>
                                    <p><strong>Fecha Registro:</strong> {formatDateStr(selectedUserDetail.created_at)}</p>
                                    <p><strong>Primer Pedido:</strong> {formatDateStr(selectedUserDetail.fecha_primer_pedido)}</p>
                                    <p><strong>Último Pedido:</strong> {formatDateStr(selectedUserDetail.fecha_ultimo_pedido)}</p>
                                    <p><strong>Pedidos Entregados:</strong> {selectedUserDetail.cantidad_pedidos || 0}</p>
                                    <p><strong>Total Gastado:</strong> {formatCurrency(selectedUserDetail.total_gastado)}</p>
                                    <p><strong>Ticket Promedio:</strong> {formatCurrency(selectedUserDetail.ticket_promedio)}</p>
                                    <p><strong>Categoría Favorita:</strong> <span className="badge-category">{selectedUserDetail.categoria_favorita || '-'}</span></p>
                                </div>

                                {/* Dynamic Tag links inside Ficha */}
                                <div className="ficha-tags-section">
                                    <h4>Etiquetas del Usuario</h4>
                                    <div className="active-tags-grid">
                                        {(selectedUserDetail.crm_usuario_tags || []).map(t => {
                                            const tagObj = tags.find(tg => tg.id === t.tag_id);
                                            return (
                                                <span key={t.tag_id} className="active-tag-chip">
                                                    {tagObj ? tagObj.name : t.tag_id}
                                                    <button onClick={() => handleRemoveUserTag(selectedUserDetail.id, t.tag_id)}>&times;</button>
                                                </span>
                                            );
                                        })}
                                        {(selectedUserDetail.crm_usuario_tags || []).length === 0 && <p className="empty-text">Sin etiquetas.</p>}
                                    </div>

                                    {/* Link new tag */}
                                    <select 
                                        className="select-add-tag"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleAddUserTag(selectedUserDetail.id, e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                    >
                                        <option value="">Añadir etiqueta...</option>
                                        {tags.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Direct interaction */}
                                <div className="ficha-direct-send-section">
                                    <h4>Enviar Mensaje de CRM</h4>
                                    <div className="form-group">
                                        <label>Canal Preferido</label>
                                        <select 
                                            value={selectedUserTemplateChannel}
                                            onChange={(e) => setSelectedUserTemplateChannel(e.target.value)}
                                        >
                                            <option value="push">Push Notification (OneSignal / Fallback WA)</option>
                                            <option value="whatsapp">WhatsApp Direct (wa.me o Meta API)</option>
                                            <option value="email">Email</option>
                                            <option value="sms">SMS</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Mensaje (Soporta [Nombre])</label>
                                        <textarea 
                                            rows="3" 
                                            placeholder="Escribe tu mensaje..."
                                            value={selectedUserTemplateText}
                                            onChange={(e) => setSelectedUserTemplateText(e.target.value)}
                                        />
                                    </div>
                                    <button className="btn-send" onClick={handleSendDirectMessage}>
                                        ✉️ Despachar Mensaje
                                    </button>
                                </div>
                            </div>

                            {/* Timeline Log */}
                            <div className="timeline-log-column">
                                <h3>Historial y Actividades CRM</h3>
                                <div className="timeline-container">
                                    {/* Merge history and events into chronological timeline */}
                                    {useMemo(() => {
                                        const merged = [];
                                        userDetailHistory.forEach(h => merged.push({ ...h, type: 'history' }));
                                        userDetailEvents.forEach(e => merged.push({ ...e, type: 'event' }));
                                        return merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                                    }, [userDetailHistory, userDetailEvents]).map((log, idx) => {
                                        if (log.type === 'event') {
                                            return (
                                                <div key={`ev-${log.id}-${idx}`} className="timeline-item event">
                                                    <div className="time-badge">{formatDateStr(log.created_at)} {new Date(log.created_at).toLocaleTimeString().substring(0, 5)}</div>
                                                    <div className="timeline-content">
                                                        <span className="type">EVENTO: <code>{log.event_type}</code></span>
                                                        {log.metadata && <span className="meta">{JSON.stringify(log.metadata)}</span>}
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div key={`hist-${log.id}-${idx}`} className={`timeline-item history ${log.tipo}`}>
                                                    <div className="time-badge">{formatDateStr(log.created_at)} {new Date(log.created_at).toLocaleTimeString().substring(0, 5)}</div>
                                                    <div className="timeline-content">
                                                        <span className="type">ACCION: {log.tipo.toUpperCase()}</span>
                                                        <p className="desc">{log.descripcion}</p>
                                                        {log.canal && <span className="channel">Canal: {log.canal}</span>}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    })}
                                    {userDetailHistory.length === 0 && userDetailEvents.length === 0 && (
                                        <p className="empty">Sin actividades de CRM registradas en el perfil.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AUTOMATION EDIT MODAL */}
            {showAutomationModal && (
                <div className="crm-modal-overlay" onClick={() => setShowAutomationModal(false)}>
                    <div className="crm-modal-content form-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{activeAutomation ? 'Editar Automatización' : 'Nueva Automatización'}</h2>
                            <button className="close-btn" onClick={() => setShowAutomationModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body-vertical">
                            <div className="form-group">
                                <label>Nombre de la regla</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: Bienvenida Santo Tomé"
                                    value={automationForm.nombre}
                                    onChange={(e) => setAutomationForm(prev => ({ ...prev, nombre: e.target.value }))}
                                />
                            </div>

                            <div className="form-group-row">
                                <div className="form-group">
                                    <label>Evento Disparador</label>
                                    <select 
                                        value={automationForm.evento_disparador}
                                        onChange={(e) => setAutomationForm(prev => ({ ...prev, evento_disparador: e.target.value }))}
                                    >
                                        <option value="USER_REGISTERED">USER_REGISTERED (Registro de usuario)</option>
                                        <option value="FIRST_ORDER">FIRST_ORDER (Primer pedido)</option>
                                        <option value="SECOND_ORDER">SECOND_ORDER (Segundo pedido)</option>
                                        <option value="THIRD_ORDER">THIRD_ORDER (Tercer pedido)</option>
                                        <option value="FIFTH_ORDER">FIFTH_ORDER (Quinto pedido)</option>
                                        <option value="VIP_REACHED">VIP_REACHED (VIP alcanzado)</option>
                                        <option value="ORDER_CANCELLED">ORDER_CANCELLED (Pedido cancelado)</option>
                                        <option value="USER_DORMANT_7">USER_DORMANT_7 (7 días inactivo)</option>
                                        <option value="USER_DORMANT_15">USER_DORMANT_15 (15 días inactivo)</option>
                                        <option value="USER_DORMANT_30">USER_DORMANT_30 (30 días inactivo/Dormido)</option>
                                        <option value="USER_RECOVERED">USER_RECOVERED (Cliente recuperado)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Canal Preferente</label>
                                    <select 
                                        value={automationForm.canal}
                                        onChange={(e) => setAutomationForm(prev => ({ ...prev, canal: e.target.value }))}
                                    >
                                        <option value="push">Push Notification (Con fallback a WA)</option>
                                        <option value="whatsapp">WhatsApp Direct (wa.me o API)</option>
                                        <option value="email">Email</option>
                                        <option value="sms">SMS</option>
                                    </select>
                                </div>
                            </div>

                            <h3>Condiciones de Aplicación</h3>
                            <div className="form-group-row">
                                <div className="form-group">
                                    <label>Ciudad</label>
                                    <select 
                                        value={automationForm.condiciones.ciudad}
                                        onChange={(e) => setAutomationForm(prev => ({ 
                                            ...prev, 
                                            condiciones: { ...prev.condiciones, ciudad: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Todas las ciudades</option>
                                        <option value="Santo Tomé">Santo Tomé</option>
                                        <option value="Oberá">Oberá</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Categoría Favorita</label>
                                    <select 
                                        value={automationForm.condiciones.categoria_favorita}
                                        onChange={(e) => setAutomationForm(prev => ({ 
                                            ...prev, 
                                            condiciones: { ...prev.condiciones, categoria_favorita: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Cualquiera</option>
                                        <option value="Helados">Helados</option>
                                        <option value="Farmacia">Farmacia</option>
                                        <option value="Shops">Shops</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Mensaje del Disparador (Usa <code>[Nombre]</code>)</label>
                                <textarea 
                                    rows="4" 
                                    placeholder="¡Hola [Nombre]! Gracias por tu registro..."
                                    value={automationForm.mensaje}
                                    onChange={(e) => setAutomationForm(prev => ({ ...prev, mensaje: e.target.value }))}
                                />
                            </div>

                            <div className="form-group-row">
                                <div className="form-group">
                                    <label>Tiempo de espera (minutos)</label>
                                    <input 
                                        type="number" 
                                        value={automationForm.tiempo_espera}
                                        onChange={(e) => setAutomationForm(prev => ({ ...prev, tiempo_espera: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Prioridad</label>
                                    <input 
                                        type="number" 
                                        value={automationForm.prioridad}
                                        onChange={(e) => setAutomationForm(prev => ({ ...prev, prioridad: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                                <input 
                                    type="checkbox" 
                                    id="aut-form-estado"
                                    checked={automationForm.estado}
                                    onChange={(e) => setAutomationForm(prev => ({ ...prev, estado: e.target.checked }))}
                                />
                                <label htmlFor="aut-form-estado" style={{ margin: 0 }}>Habilitada (Activa)</label>
                            </div>

                            <div className="form-buttons">
                                <button className="btn-cancel" onClick={() => setShowAutomationModal(false)}>Cancelar</button>
                                <button className="btn-confirm" onClick={handleSaveAutomation}>💾 Guardar Regla</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCRM;
