import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './AdminChatbot.css';

const DEFAULT_FLOW_DATA = {
    inicio: {
        mensaje: "👋 ¡Hola! Soy Wepi Bot.\n\n¿En qué puedo ayudarte?",
        keywords: "hola, buenas, inicio, menu, empiece, empezar, hi, hello, saludos",
        opciones: [
            { key: "1", label: "1️⃣ 🍔 Hacer un pedido", action: "hacer_pedido", keywords: "1, pedir, hacer un pedido, carta, menu, comprar, orden" },
            { key: "2", label: "2️⃣ 📦 Estado de mi pedido", action: "estado_pedido", keywords: "2, estado, mi pedido, donde esta, seguimiento, rastrear" },
            { key: "3", label: "3️⃣ 👨 Hablar con soporte", action: "soporte", keywords: "3, 4, hablar con soporte, soporte, humano, agente, reclamo" }
        ]
    },
    hacer_pedido: {
        mensaje: "🍔 Elegí tu ciudad.\n(O usar ubicación)",
        keywords: "1, pedir, hacer un pedido, carta, menu, comprar, orden",
        ciudades: [
            { nombre: "Santo Tomé", slug: "santo-tome" },
            { nombre: "Oberá", slug: "obera" },
            { nombre: "Apóstoles", slug: "apostoles" },
            { nombre: "Alem", slug: "alem" },
            { nombre: "Goya", slug: "goya" }
        ],
        footer: "↓\nAbrí Wepi y hacé tu pedido 👇\nwepi.com.ar/pedir/"
    },
    estado_pedido: {
        mensaje: "📦 Podés consultar el estado de tu pedido en tiempo real ingresando aquí 👇\nhttps://wepi.com.ar/mis-pedidos",
        keywords: "2, estado, mi pedido, donde esta, seguimiento, rastrear"
    },
    soporte: {
        mensaje: "👨 Te estamos derivando con el equipo de Soporte de Wepi.\n\nHacé clic en el siguiente enlace para chatear con un agente:\nhttps://wa.me/5493756543610",
        keywords: "3, 4, soporte, humano, agente, persona, reclamo, ayuda humana"
    },
    seguimientos: {
        sin_repartidor: "😔 No encontramos un repartidor disponible en este momento.\nPodés repetirlo en un solo clic: https://wepi.com.ar/mis-pedidos\n\nApenas haya repartidores disponibles te avisaremos.",
        repartidores_disponibles: "🛵 Ya tenemos repartidores disponibles\nPodés repetir tu pedido en un solo clic: https://wepi.com.ar/mis-pedidos"
    }
};

const AdminChatbot = () => {
    const [activeSubTab, setActiveSubTab] = useState('flujos');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Flow Data
    const [flowData, setFlowData] = useState(DEFAULT_FLOW_DATA);
    const [selectedStep, setSelectedStep] = useState('inicio');

    // Templates Data
    const [templates, setTemplates] = useState([]);
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        category: 'UTILITY',
        language: 'es_AR',
        body_text: '',
        status: 'APPROVED'
    });

    // Opt-ins Data
    const [optins, setOptins] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const flows = await api.getWhatsappBotFlows();
            if (flows && flows.flow_data) {
                setFlowData(flows.flow_data);
            }
            const tmplList = await api.getWhatsappTemplates();
            setTemplates(tmplList);

            const optinList = await api.getWhatsappOptins();
            setOptins(optinList);
        } catch (err) {
            console.error("Error cargando datos del chatbot:", err);
            toast.error("Error al cargar configuración del Chatbot");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveFlows = async () => {
        setSaving(true);
        try {
            await api.updateWhatsappBotFlows(flowData);
            toast.success("Flujos y Palabras Activadoras guardados con éxito 🟢");
        } catch (err) {
            console.error("Error al guardar flujos:", err);
            toast.error("Error al guardar flujos: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateTemplate = async (e) => {
        e.preventDefault();
        if (!newTemplate.name || !newTemplate.body_text) {
            toast.error("Completá el nombre y el cuerpo de la plantilla");
            return;
        }
        setSaving(true);
        try {
            await api.saveWhatsappTemplate({
                name: newTemplate.name.toLowerCase().replace(/\s+/g, '_'),
                category: newTemplate.category,
                language: newTemplate.language,
                body_text: newTemplate.body_text,
                status: 'APPROVED'
            });
            toast.success("Plantilla creada correctamente");
            setNewTemplate({ name: '', category: 'UTILITY', language: 'es_AR', body_text: '', status: 'APPROVED' });
            const updatedTmpl = await api.getWhatsappTemplates();
            setTemplates(updatedTmpl);
        } catch (err) {
            toast.error("Error al crear plantilla: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm("¿Seguro que querés eliminar esta plantilla?")) return;
        try {
            await api.deleteWhatsappTemplate(id);
            toast.success("Plantilla eliminada");
            setTemplates(templates.filter(t => t.id !== id));
        } catch (err) {
            toast.error("Error al eliminar plantilla");
        }
    };

    if (loading) {
        return (
            <div className="admin-chatbot-container" style={{ textAlign: 'center', padding: '60px' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                <p>Cargando configuración del Chatbot de WhatsApp...</p>
            </div>
        );
    }

    return (
        <div className="admin-chatbot-container animate-fade-in">
            <div className="chatbot-header">
                <div className="chatbot-header-title">
                    <span style={{ fontSize: '2rem' }}>💬</span>
                    <div>
                        <h1>Configuración de Chatbot de WhatsApp</h1>
                        <p>Gestión de flujos, palabras activadoras (triggers), plantillas Meta API y canal de soporte</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="phone-badge">
                        📱 Bot Principal: +54 9 3756 543670
                    </div>
                    <div className="phone-badge" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                        📞 Soporte: +54 9 3756 543610
                    </div>
                </div>
            </div>

            <div className="chatbot-tabs">
                <button 
                    className={`tab-btn ${activeSubTab === 'flujos' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('flujos')}
                >
                    🗺️ Flujos y Palabras Activadoras
                </button>
                <button 
                    className={`tab-btn ${activeSubTab === 'seguimientos' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('seguimientos')}
                >
                    🔄 Flujos de Seguimiento y Opt-in
                </button>
                <button 
                    className={`tab-btn ${activeSubTab === 'plantillas' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('plantillas')}
                >
                    📜 Plantillas Meta API (HSM)
                </button>
                <button 
                    className={`tab-btn ${activeSubTab === 'optins' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('optins')}
                >
                    📋 Registros Opt-in ({optins.length})
                </button>
            </div>

            {/* TAB 1: FLUJOS INTERACTIVOS & PALABRAS ACTIVADORAS */}
            {activeSubTab === 'flujos' && (
                <div className="chatbot-grid">
                    <div className="card-panel">
                        <h2>✏️ Editar Mensajes y Palabras Activadoras (Triggers)</h2>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <button 
                                className={`btn ${selectedStep === 'inicio' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setSelectedStep('inicio')}
                            >
                                🏠 Inicio (Menú Principal)
                            </button>
                            <button 
                                className={`btn ${selectedStep === 'hacer_pedido' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setSelectedStep('hacer_pedido')}
                            >
                                1. Hacer un pedido
                            </button>
                            <button 
                                className={`btn ${selectedStep === 'estado_pedido' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setSelectedStep('estado_pedido')}
                            >
                                2. Estado de mi pedido
                            </button>
                            <button 
                                className={`btn ${selectedStep === 'soporte' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setSelectedStep('soporte')}
                            >
                                3. Hablar con Soporte
                            </button>
                        </div>

                        {/* PASO: INICIO */}
                        {selectedStep === 'inicio' && (
                            <div>
                                <div className="form-group">
                                    <label>Mensaje de Saludo Principal:</label>
                                    <textarea 
                                        className="form-control"
                                        rows={4}
                                        value={flowData.inicio?.mensaje || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            inicio: { ...flowData.inicio, mensaje: e.target.value }
                                        })}
                                    />
                                </div>
                                <div className="form-group" style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                    <label style={{ color: '#166534' }}>🏷️ Palabras Activadoras para Saludo Inicial (separadas por coma):</label>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        placeholder="hola, buenas, inicio, menu, empiece, empezar"
                                        value={flowData.inicio?.keywords || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            inicio: { ...flowData.inicio, keywords: e.target.value }
                                        })}
                                    />
                                </div>

                                <h3 style={{ marginTop: '20px' }}>Opciones del Menú Principal:</h3>
                                {flowData.inicio?.opciones?.map((op, idx) => (
                                    <div key={idx} style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
                                        <div className="form-group">
                                            <label>Etiqueta Opción {op.key}:</label>
                                            <input 
                                                type="text" 
                                                className="form-control"
                                                value={op.label}
                                                onChange={(e) => {
                                                    const newOpts = [...flowData.inicio.opciones];
                                                    newOpts[idx].label = e.target.value;
                                                    setFlowData({ ...flowData, inicio: { ...flowData.inicio, opciones: newOpts } });
                                                }}
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ color: '#0369a1', fontSize: '0.8rem' }}>🏷️ Palabras Activadoras para esta opción:</label>
                                            <input 
                                                type="text" 
                                                className="form-control"
                                                placeholder="ej: 1, pedir, hacer un pedido, carta, menu"
                                                value={op.keywords || ''}
                                                onChange={(e) => {
                                                    const newOpts = [...flowData.inicio.opciones];
                                                    newOpts[idx].keywords = e.target.value;
                                                    setFlowData({ ...flowData, inicio: { ...flowData.inicio, opciones: newOpts } });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* PASO: HACER PEDIDO */}
                        {selectedStep === 'hacer_pedido' && (
                            <div>
                                <div className="form-group">
                                    <label>Mensaje Encabezado:</label>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        value={flowData.hacer_pedido?.mensaje || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            hacer_pedido: { ...flowData.hacer_pedido, mensaje: e.target.value }
                                        })}
                                    />
                                </div>
                                <div className="form-group" style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                    <label style={{ color: '#166534' }}>🏷️ Palabras Activadoras (Triggers):</label>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        placeholder="1, pedir, hacer un pedido, carta, menu, comprar, orden"
                                        value={flowData.hacer_pedido?.keywords || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            hacer_pedido: { ...flowData.hacer_pedido, keywords: e.target.value }
                                        })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Texto Footer y Link:</label>
                                    <textarea 
                                        className="form-control"
                                        rows={3}
                                        value={flowData.hacer_pedido?.footer || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            hacer_pedido: { ...flowData.hacer_pedido, footer: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>
                        )}

                        {/* PASO: ESTADO PEDIDO */}
                        {selectedStep === 'estado_pedido' && (
                            <div>
                                <div className="form-group">
                                    <label>Mensaje Estado del Pedido:</label>
                                    <textarea 
                                        className="form-control"
                                        rows={3}
                                        value={flowData.estado_pedido?.mensaje || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            estado_pedido: { ...flowData.estado_pedido, mensaje: e.target.value }
                                        })}
                                    />
                                </div>
                                <div className="form-group" style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                    <label style={{ color: '#166534' }}>🏷️ Palabras Activadoras (Triggers):</label>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        placeholder="2, estado, mi pedido, donde esta, seguimiento, rastrear"
                                        value={flowData.estado_pedido?.keywords || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            estado_pedido: { ...flowData.estado_pedido, keywords: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>
                        )}

                        {/* PASO: AYUDA */}
                        {selectedStep === 'ayuda' && (
                            <div>
                                <div className="form-group">
                                    <label>Título Submenú Ayuda:</label>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        value={flowData.ayuda?.mensaje || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            ayuda: { ...flowData.ayuda, mensaje: e.target.value }
                                        })}
                                    />
                                </div>
                                <div className="form-group" style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                    <label style={{ color: '#166534' }}>🏷️ Palabras Activadoras para entrar al menú Ayuda:</label>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        placeholder="3, ayuda, consulta, duda, faq"
                                        value={flowData.ayuda?.keywords || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            ayuda: { ...flowData.ayuda, keywords: e.target.value }
                                        })}
                                    />
                                </div>

                                <h4>Respuestas y Triggers de Sub-opciones:</h4>
                                {flowData.ayuda?.opciones?.map((sub, idx) => (
                                    <div key={idx} style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
                                        <label style={{ fontWeight: '700' }}>Opción {sub.key}: {sub.titulo}</label>
                                        <textarea 
                                            className="form-control"
                                            rows={3}
                                            style={{ marginTop: '6px', marginBottom: '8px' }}
                                            value={sub.respuesta}
                                            onChange={(e) => {
                                                const newOpts = [...flowData.ayuda.opciones];
                                                newOpts[idx].respuesta = e.target.value;
                                                setFlowData({ ...flowData, ayuda: { ...flowData.ayuda, opciones: newOpts } });
                                            }}
                                        />
                                        <label style={{ color: '#0369a1', fontSize: '0.8rem', fontWeight: '700' }}>🏷️ Palabras Activadoras para esta sub-opción:</label>
                                        <input 
                                            type="text"
                                            className="form-control"
                                            placeholder="ej: 1, 3.1, pagar, pago, efectivo, tarjeta"
                                            value={sub.keywords || ''}
                                            onChange={(e) => {
                                                const newOpts = [...flowData.ayuda.opciones];
                                                newOpts[idx].keywords = e.target.value;
                                                setFlowData({ ...flowData, ayuda: { ...flowData.ayuda, opciones: newOpts } });
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* PASO: SOPORTE */}
                        {selectedStep === 'soporte' && (
                            <div>
                                <div className="form-group">
                                    <label>Mensaje de Derivación a Soporte (3756543610):</label>
                                    <textarea 
                                        className="form-control"
                                        rows={4}
                                        value={flowData.soporte?.mensaje || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            soporte: { ...flowData.soporte, mensaje: e.target.value }
                                        })}
                                    />
                                </div>
                                <div className="form-group" style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                    <label style={{ color: '#166534' }}>🏷️ Palabras Activadoras (Triggers):</label>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        placeholder="4, hablar con soporte, soporte, humano, agente, reclamo"
                                        value={flowData.soporte?.keywords || ''}
                                        onChange={(e) => setFlowData({
                                            ...flowData,
                                            soporte: { ...flowData.soporte, keywords: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>
                        )}

                        <button 
                            className="btn-whatsapp-save"
                            style={{ marginTop: '20px' }}
                            disabled={saving}
                            onClick={handleSaveFlows}
                        >
                            💾 {saving ? 'Guardando...' : 'Guardar Mensajes y Palabras Activadoras'}
                        </button>
                    </div>

                    {/* PREVISUALIZACIÓN SIMULADA DE WHATSAPP */}
                    <div className="card-panel">
                        <h2>📱 Previsualización en Vivo</h2>
                        <div className="whatsapp-preview-card">
                            <div className="chat-bubble">
                                {selectedStep === 'inicio' && (
                                    <>
                                        <div>{flowData.inicio?.mensaje}</div>
                                        <div className="chat-bubble-actions">
                                            {flowData.inicio?.opciones?.map((op, i) => (
                                                <div key={i} className="chat-bubble-btn">{op.label}</div>
                                            ))}
                                        </div>
                                        {flowData.inicio?.keywords && (
                                            <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: '6px', fontStyle: 'italic' }}>
                                                🏷️ Triggers: {flowData.inicio?.keywords}
                                            </div>
                                        )}
                                    </>
                                )}
                                {selectedStep === 'hacer_pedido' && (
                                    <>
                                        <div>{flowData.hacer_pedido?.mensaje}</div>
                                        <div style={{ margin: '8px 0', fontSize: '0.82rem' }}>
                                            {flowData.hacer_pedido?.ciudades?.map(c => `• ${c.nombre}`).join('\n')}
                                        </div>
                                        <div>{flowData.hacer_pedido?.footer}</div>
                                        {flowData.hacer_pedido?.keywords && (
                                            <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: '6px', fontStyle: 'italic' }}>
                                                🏷️ Triggers: {flowData.hacer_pedido?.keywords}
                                            </div>
                                        )}
                                    </>
                                )}
                                {selectedStep === 'estado_pedido' && (
                                    <>
                                        <div>{flowData.estado_pedido?.mensaje}</div>
                                        {flowData.estado_pedido?.keywords && (
                                            <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: '6px', fontStyle: 'italic' }}>
                                                🏷️ Triggers: {flowData.estado_pedido?.keywords}
                                            </div>
                                        )}
                                    </>
                                )}
                                {selectedStep === 'ayuda' && (
                                    <>
                                        <div style={{ fontWeight: 'bold' }}>{flowData.ayuda?.mensaje}</div>
                                        <div className="chat-bubble-actions">
                                            {flowData.ayuda?.opciones?.map((sub, i) => (
                                                <div key={i} className="chat-bubble-btn">{sub.titulo}</div>
                                            ))}
                                        </div>
                                        {flowData.ayuda?.keywords && (
                                            <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: '6px', fontStyle: 'italic' }}>
                                                🏷️ Triggers: {flowData.ayuda?.keywords}
                                            </div>
                                        )}
                                    </>
                                )}
                                {selectedStep === 'soporte' && (
                                    <>
                                        <div>{flowData.soporte?.mensaje}</div>
                                        {flowData.soporte?.keywords && (
                                            <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: '6px', fontStyle: 'italic' }}>
                                                🏷️ Triggers: {flowData.soporte?.keywords}
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="chat-bubble-time">12:30 p.m.</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: FLUJOS DE SEGUIMIENTO */}
            {activeSubTab === 'seguimientos' && (
                <div className="chatbot-grid">
                    <div className="card-panel">
                        <h2>🛵 Mensajes Automáticos de Seguimiento</h2>

                        {/* TOGGLE SWITCH DE ACTIVACIÓN */}
                        <div style={{
                            background: flowData.seguimientos?.enabled !== false ? '#f0fdf4' : '#fef2f2',
                            border: flowData.seguimientos?.enabled !== false ? '1px solid #a7f3d0' : '1px solid #fecaca',
                            padding: '16px',
                            borderRadius: '12px',
                            marginBottom: '20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: flowData.seguimientos?.enabled !== false ? '#065f46' : '#991b1b' }}>
                                    {flowData.seguimientos?.enabled !== false ? '🟢 Seguimientos Automáticos Activados' : '🔴 Seguimientos Automáticos Desactivados'}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: flowData.seguimientos?.enabled !== false ? '#047857' : '#b91c1c' }}>
                                    {flowData.seguimientos?.enabled !== false 
                                        ? '🔒 SEGURIDAD: Los avisos se enviarán ÚNICAMENTE a los usuarios que hayan aceptado la opción Opt-in desde /pedir.' 
                                        : 'Los envíos automáticos de seguimiento están pausados.'}
                                </p>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                <input 
                                    type="checkbox"
                                    checked={flowData.seguimientos?.enabled !== false}
                                    onChange={(e) => setFlowData({
                                        ...flowData,
                                        seguimientos: {
                                            ...flowData.seguimientos,
                                            enabled: e.target.checked
                                        }
                                    })}
                                    style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#059669' }}
                                />
                                <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                                    {flowData.seguimientos?.enabled !== false ? 'ACTIVADO' : 'DESACTIVADO'}
                                </span>
                            </label>
                        </div>
                        
                        <div className="form-group">
                            <label>1. Pedido no tomado por ningún repartidor:</label>
                            <textarea 
                                className="form-control"
                                rows={4}
                                value={flowData.seguimientos?.sin_repartidor || ''}
                                onChange={(e) => setFlowData({
                                    ...flowData,
                                    seguimientos: { ...flowData.seguimientos, sin_repartidor: e.target.value }
                                })}
                            />
                        </div>

                        <div className="form-group">
                            <label>2. Ya hay repartidores disponibles nuevamente:</label>
                            <textarea 
                                className="form-control"
                                rows={4}
                                value={flowData.seguimientos?.repartidores_disponibles || ''}
                                onChange={(e) => setFlowData({
                                    ...flowData,
                                    seguimientos: { ...flowData.seguimientos, repartidores_disponibles: e.target.value }
                                })}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                            <button 
                                className="btn-whatsapp-save"
                                disabled={saving}
                                onClick={handleSaveFlows}
                            >
                                💾 Guardar Ajustes de Seguimiento
                            </button>
                        </div>
                    </div>

                    <div className="card-panel">
                        <h2>📱 Previsualización de Seguimiento</h2>
                        <div className="whatsapp-preview-card">
                            <div className="chat-bubble">
                                <div>{flowData.seguimientos?.sin_repartidor}</div>
                                <div className="chat-bubble-time">12:35 p.m.</div>
                            </div>
                            <div className="chat-bubble" style={{ marginTop: '12px' }}>
                                <div>{flowData.seguimientos?.repartidores_disponibles}</div>
                                <div className="chat-bubble-time">12:45 p.m.</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: PLANTILLAS META HSM */}
            {activeSubTab === 'plantillas' && (
                <div className="chatbot-grid">
                    <div className="card-panel">
                        <h2>➕ Crear / Configurar Plantilla WhatsApp API (HSM)</h2>
                        <form onSubmit={handleCreateTemplate}>
                            <div className="form-group">
                                <label>Nombre de la Plantilla (Identificador Meta):</label>
                                <input 
                                    type="text" 
                                    className="form-control"
                                    placeholder="ej: pedido_sin_repartidor"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label>Categoría:</label>
                                    <select 
                                        className="form-control"
                                        value={newTemplate.category}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                                    >
                                        <option value="UTILITY">UTILITY (Servicio/Pedidos)</option>
                                        <option value="MARKETING">MARKETING (Promociones)</option>
                                        <option value="AUTHENTICATION">AUTHENTICATION (Seguridad)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Idioma:</label>
                                    <select 
                                        className="form-control"
                                        value={newTemplate.language}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, language: e.target.value })}
                                    >
                                        <option value="es_AR">Español (Argentina)</option>
                                        <option value="es">Español (General)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Cuerpo de la Plantilla (Usa &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; para variables):</label>
                                <textarea 
                                    className="form-control"
                                    rows={4}
                                    placeholder="ej: Hola {{1}}, tu pedido {{2}} ya está listo."
                                    value={newTemplate.body_text}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, body_text: e.target.value })}
                                />
                            </div>

                            <button className="btn-whatsapp-save" type="submit" disabled={saving}>
                                💾 Registrar Plantilla
                            </button>
                        </form>
                    </div>

                    <div className="card-panel">
                        <h2>📜 Plantillas Registradas ({templates.length})</h2>
                        {templates.length === 0 ? (
                            <p style={{ color: '#64748b' }}>No hay plantillas registradas aún.</p>
                        ) : (
                            templates.map(tmpl => (
                                <div key={tmpl.id} className="template-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <strong>{tmpl.name}</strong>
                                        <span className={`template-badge badge-${tmpl.status?.toLowerCase()}`}>
                                            {tmpl.status}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', margin: '4px 0 8px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                                        {tmpl.body_text}
                                    </p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                                        <span>Categoría: {tmpl.category} ({tmpl.language})</span>
                                        <button 
                                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                                            onClick={() => handleDeleteTemplate(tmpl.id)}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 4: REGISTROS OPT-IN */}
            {activeSubTab === 'optins' && (
                <div className="card-panel">
                    <h2>📋 Consentimientos de Opt-in Registrados desde /pedir</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Usuarios que solicitaron la notificación *"Recibir aviso cuando haya un repartidor disponible"*:
                    </p>

                    {optins.length === 0 ? (
                        <p style={{ color: '#64748b', marginTop: '16px' }}>No hay solicitudes de Opt-in registradas recientemente.</p>
                    ) : (
                        <table className="optins-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Teléfono</th>
                                    <th>Ciudad</th>
                                    <th>Pedido ID</th>
                                    <th>Tipo</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {optins.map((o) => (
                                    <tr key={o.id}>
                                        <td>{new Date(o.created_at).toLocaleString()}</td>
                                        <td><strong>{o.phone_number}</strong></td>
                                        <td>{o.ciudad}</td>
                                        <td>{o.pedido_id || 'N/A'}</td>
                                        <td>{o.tipo}</td>
                                        <td>
                                            <span style={{ 
                                                background: o.status === 'NOTIFIED' ? '#dcfce7' : '#fef3c7',
                                                color: o.status === 'NOTIFIED' ? '#15803d' : '#b45309',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontWeight: 'bold',
                                                fontSize: '0.75rem'
                                            }}>
                                                {o.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminChatbot;
