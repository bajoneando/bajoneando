import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const addEmailTrackingToUrl = (url, campaignSubject, city) => {
    if (!url || !url.trim()) return url;
    try {
        const cleanUrl = url.trim();
        const hasParams = cleanUrl.includes('?');
        const campaignName = campaignSubject ? campaignSubject.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 30) : 'General';
        const params = `ref=email&campaign=${encodeURIComponent(campaignName)}${city ? `&city=${encodeURIComponent(city)}` : ''}`;
        return `${cleanUrl}${hasParams ? '&' : '?'}${params}`;
    } catch (e) {
        return url;
    }
};

const AdminEmails = () => {
    const [target, setTarget] = useState('usuarios');
    const [manualEmails, setManualEmails] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [buttonText, setButtonText] = useState('');
    const [buttonUrl, setButtonUrl] = useState('');
    const [sending, setSending] = useState(false);
    const [cities, setCities] = useState([]);
    const [selectedCity, setSelectedCity] = useState('');

    // Segmentación y Pruebas A/B de Marketing
    const [segmentType, setSegmentType] = useState('split'); // 'split' | 'activity' | 'sample'
    const [numSegments, setNumSegments] = useState(2); // 2, 3, 4, 5
    const [segmentIndex, setSegmentIndex] = useState(0); // 0 (A), 1 (B), 2 (C), etc.
    const [activityType, setActivityType] = useState('new'); // 'new' | 'active'
    const [samplePercentage, setSamplePercentage] = useState(50); // 10, 25, 50
    const [previewCount, setPreviewCount] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        const loadCities = async () => {
            try {
                const data = await api.getCiudadesConfig();
                const cityList = data || [];
                const existingNames = cityList.map(c => c.ciudad);
                const extraCities = ['Santo Tomé', 'Oberá', 'Alem (Misiones)', 'Apóstoles (Misiones)', 'Goya (Corrientes)'];
                extraCities.forEach(c => {
                    if (!existingNames.includes(c)) {
                        cityList.push({ ciudad: c });
                    }
                });
                setCities(cityList);
                if (cityList.length > 0) {
                    setSelectedCity(cityList[0].ciudad);
                }
            } catch (err) {
                console.error('Error fetching cities:', err);
            }
        };
        loadCities();
    }, []);

    // Live preview count update
    useEffect(() => {
        let isMounted = true;
        const updateCount = async () => {
            setPreviewLoading(true);
            try {
                const emails = await api.getSegmentedRecipients({
                    target,
                    manualEmails: target === 'manual' ? manualEmails : null,
                    ciudad: (target === 'usuarios_ciudad' || target === 'usuarios_segmento') ? selectedCity : null,
                    segmentType: target === 'usuarios_segmento' ? segmentType : 'none',
                    numSegments: Number(numSegments),
                    segmentIndex: Number(segmentIndex),
                    activityType,
                    samplePercentage: Number(samplePercentage)
                });
                if (isMounted) setPreviewCount(emails.length);
            } catch (err) {
                console.error("Error al calcular vista previa del segmento:", err);
            } finally {
                if (isMounted) setPreviewLoading(false);
            }
        };
        updateCount();
        return () => { isMounted = false; };
    }, [target, manualEmails, selectedCity, segmentType, numSegments, segmentIndex, activityType, samplePercentage]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!subject || !message) {
            toast.error('Asunto y mensaje son obligatorios');
            return;
        }

        setSending(true);
        const loading = toast.loading('Enviando emails...');

        try {
            const htmlBody = `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="https://i.postimg.cc/wjN5JF7h/wepi-(1).png" alt="Wepi" style="width: 120px; height: auto;">
                    </div>
                    <div style="background-color: #d32f2f; padding: 2px; border-radius: 4px; margin-bottom: 30px;"></div>
                    <h1 style="color: #1e293b; font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 20px;">${subject}</h1>
                    <div style="font-size: 16px; color: #475569; line-height: 1.8; margin-bottom: 40px; white-space: pre-wrap;">
${message}
                    </div>
                    ${buttonText && buttonUrl ? `
                    <div style="text-align: center; margin-bottom: 40px;">
                        <a href="${addEmailTrackingToUrl(buttonUrl, subject, selectedCity)}" style="display: inline-block; padding: 14px 28px; background-color: #d32f2f; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            ${buttonText}
                        </a>
                    </div>
                    ` : ''}
                    <div style="background-color: #f8fafc; padding: 30px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0;">
                        <h3 style="color: #d32f2f; margin-bottom: 10px; font-size: 18px;">WEPI — Plataforma de pedidos y delivery</h3>
                    </div>
                    <div style="text-align: center; margin-top: 40px; color: #94a3b8; font-size: 12px;">
                        <p>© ${new Date().getFullYear()} WEPI. Todos los derechos reservados.</p>
                        <p>Este es un mensaje institucional enviado desde la plataforma oficial de Wepi.</p>
                    </div>
                </div>
            `;

            let manualList = null;
            if (target === 'manual') {
                manualList = manualEmails.split(/[\s,]+/).filter(e => e && e.includes('@'));
                if (manualList.length === 0) {
                    toast.error('Por favor ingresa al menos un email válido', { id: loading });
                    setSending(false);
                    return;
                }
            }

            const res = await api.adminSendBulkEmail({ 
                target, 
                manualEmails: manualList, 
                subject, 
                htmlBody,
                ciudad: (target === 'usuarios_ciudad' || target === 'usuarios_segmento') ? selectedCity : null,
                segmentType: target === 'usuarios_segmento' ? segmentType : 'none',
                numSegments: Number(numSegments),
                segmentIndex: Number(segmentIndex),
                activityType,
                samplePercentage: Number(samplePercentage)
            });

            if (res.success) {
                toast.success(`Emails enviados a ${res.count} destinatarios!`, { id: loading });
                setSubject('');
                setMessage('');
                setButtonText('');
                setButtonUrl('');
            } else {
                toast.error(res.error || 'Error al enviar emails', { id: loading });
            }
        } catch (err) {
            toast.error('Error de conexión con el servidor', { id: loading });
        } finally {
            setSending(false);
        }
    };

    const getSegmentLetter = (index) => String.fromCharCode(65 + index); // 0 -> A, 1 -> B, 2 -> C...

    return (
        <div className="panel-card animate-fade-in" style={{ maxWidth: '820px' }}>
            <header className="panel-header" style={{ marginBottom: '1.5rem' }}>
                <h2>📧 Panel de Marketing & Avisos por Email</h2>
            </header>

            <form onSubmit={handleSend} className="admin-form">
                <div className="form-group">
                    <label style={{ fontWeight: '600' }}>Segmento / Audiencia de Envío:</label>
                    <select value={target} onChange={(e) => setTarget(e.target.value)} className="form-control" style={{ fontWeight: '600' }}>
                        <option value="usuarios">👥 Todos los Usuarios</option>
                        <option value="usuarios_ciudad">🏙️ Usuarios por Ciudad (Completo)</option>
                        <option value="usuarios_segmento">🧪 Segmentar Ciudad (Pruebas A/B Marketing)</option>
                        <option value="locales">🏪 Todos los Locales</option>
                        <option value="repartidores">🛵 Todos los Repartidores</option>
                        <option value="lanzamiento">🚀 Hoja de Lanzamiento / Leads (Supabase)</option>
                        <option value="manual">✏️ Manual (Ingresar lista de emails)</option>
                    </select>
                </div>

                {/* ─── Panel de Configuración de Ciudad ─── */}
                {(target === 'usuarios_ciudad' || target === 'usuarios_segmento') && (
                    <div className="form-group">
                        <label>Seleccionar Ciudad:</label>
                        <select 
                            value={selectedCity} 
                            onChange={(e) => setSelectedCity(e.target.value)} 
                            className="form-control"
                        >
                            {cities.map(c => (
                                <option key={c.id || c.ciudad} value={c.ciudad}>{c.ciudad}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* ─── Panel de Segmentación Avanzada / Pruebas A/B ─── */}
                {target === 'usuarios_segmento' && (
                    <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid #e63946', borderRadius: '14px', padding: '18px 20px', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#e63946', fontWeight: '700', fontSize: '1rem' }}>
                            <span>🧪 Configuración de Prueba A/B en {selectedCity}</span>
                        </div>

                        <div className="form-group">
                            <label>Criterio de División de Segmento:</label>
                            <select 
                                value={segmentType} 
                                onChange={(e) => { setSegmentType(e.target.value); setSegmentIndex(0); }} 
                                className="form-control"
                            >
                                <option value="split">📊 División en Grupos A/B (Splitting por porcentaje igual)</option>
                                <option value="activity">🛍️ Por Actividad / Historial de Pedidos</option>
                                <option value="sample">🎲 Muestra Aleatoria de Prueba (% Reducido)</option>
                            </select>
                        </div>

                        {segmentType === 'split' && (
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }} className="form-group">
                                    <label>Cantidad de Grupos:</label>
                                    <select 
                                        value={numSegments} 
                                        onChange={(e) => { setNumSegments(Number(e.target.value)); setSegmentIndex(0); }} 
                                        className="form-control"
                                    >
                                        <option value={2}>2 Grupos (A / B - 50% cada uno)</option>
                                        <option value={3}>3 Grupos (A / B / C - 33% cada uno)</option>
                                        <option value={4}>4 Grupos (A / B / C / D - 25% cada uno)</option>
                                        <option value={5}>5 Grupos (20% cada uno)</option>
                                    </select>
                                </div>

                                <div style={{ flex: 1 }} className="form-group">
                                    <label>Seleccionar Grupo a Enviar:</label>
                                    <select 
                                        value={segmentIndex} 
                                        onChange={(e) => setSegmentIndex(Number(e.target.value))} 
                                        className="form-control"
                                    >
                                        {Array.from({ length: numSegments }).map((_, idx) => (
                                            <option key={idx} value={idx}>
                                                Grupo {getSegmentLetter(idx)} (Segmento {idx + 1} de {numSegments})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {segmentType === 'activity' && (
                            <div className="form-group">
                                <label>Historial del Usuario:</label>
                                <select 
                                    value={activityType} 
                                    onChange={(e) => setActivityType(e.target.value)} 
                                    className="form-control"
                                >
                                    <option value="new">🆕 Usuarios Nuevos (Sin pedidos realizados aún)</option>
                                    <option value="active">🔥 Clientes Activos (1 o más pedidos realizados)</option>
                                </select>
                            </div>
                        )}

                        {segmentType === 'sample' && (
                            <div className="form-group">
                                <label>Porcentaje de Muestra para Prueba:</label>
                                <select 
                                    value={samplePercentage} 
                                    onChange={(e) => setSamplePercentage(Number(e.target.value))} 
                                    className="form-control"
                                >
                                    <option value={10}>10% de la ciudad (Muestra chica de prueba)</option>
                                    <option value={25}>25% de la ciudad</option>
                                    <option value={50}>50% de la ciudad</option>
                                </select>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Indicador de Conteo de Destinatarios en Vivo ─── */}
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '12px 16px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                        🎯 <strong>Destinatarios calculados para este envío:</strong>
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#e63946' }}>
                        {previewLoading ? 'Calculando...' : (previewCount !== null ? `${previewCount} emails` : '0 emails')}
                    </span>
                </div>

                {target === 'manual' && (
                    <div className="form-group">
                        <label>Emails (separados por coma o espacio):</label>
                        <textarea 
                            value={manualEmails} 
                            onChange={(e) => setManualEmails(e.target.value)} 
                            className="form-control" 
                            placeholder="ejemplo1@mail.com, ejemplo2@mail.com"
                            rows="3"
                        />
                    </div>
                )}

                <div className="form-group">
                    <label>Asunto:</label>
                    <input 
                        type="text" 
                        value={subject} 
                        onChange={(e) => setSubject(e.target.value)} 
                        className="form-control" 
                        placeholder="Ej: ¡Nueva promoción disponible en tu ciudad! 🍔"
                    />
                </div>

                <div className="form-group">
                    <label>Mensaje (Soporta saltos de línea):</label>
                    <textarea 
                        value={message} 
                        onChange={(e) => setMessage(e.target.value)} 
                        className="form-control" 
                        placeholder="Escribe el contenido del email aquí..."
                        rows="10"
                    />
                </div>

                <button type="button" className="btn btn-secondary" onClick={() => { setSubject(''); setMessage(''); setButtonText(''); setButtonUrl(''); }} style={{ marginTop: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem', padding: '4px 8px', width: 'auto', background: 'transparent', border: '1px solid #475569' }}>
                    Limpiar campos
                </button>

                <div className="form-group" style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label>Texto del Botón (Opcional):</label>
                            <input 
                                type="text" 
                                value={buttonText} 
                                onChange={(e) => setButtonText(e.target.value)} 
                                className="form-control" 
                                placeholder="Ej: Ver promoción"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>URL del Botón (Opcional):</label>
                            <input 
                                type="url" 
                                value={buttonUrl} 
                                onChange={(e) => setButtonUrl(e.target.value)} 
                                className="form-control" 
                                placeholder="https://wepi.com.ar/pedir/santo-tome"
                            />
                        </div>
                    </div>

                    {buttonUrl && (
                        <div style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', fontSize: '0.8rem', color: '#94a3b8', wordBreak: 'break-all' }}>
                            📊 <strong>Enlace final que se incluirá en el correo (con seguimiento automático de clics):</strong><br />
                            <span style={{ color: '#38bdf8', fontWeight: '600' }}>
                                {addEmailTrackingToUrl(buttonUrl, subject, selectedCity)}
                            </span>
                        </div>
                    )}
                </div>

                <button type="submit" className="btn btn-primary" disabled={sending} style={{ width: '100%', marginTop: '1rem' }}>
                    {sending ? 'Enviando...' : `🚀 Enviar a ${previewCount || 0} Destinatarios`}
                </button>
            </form>

            <style>{`
                .admin-form .form-group { margin-bottom: 1.25rem; }
                .admin-form label { display: block; margin-bottom: 0.4rem; font-size: 0.88rem; color: #94a3b8; font-weight: 500; }
                .admin-form .form-control {
                    width: 100%;
                    padding: 0.7rem 0.9rem;
                    border-radius: 0.75rem;
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    font-size: 0.95rem;
                    transition: border-color 0.2s;
                }
                .admin-form .form-control:focus {
                    outline: none;
                    border-color: #d32f2f;
                    background: rgba(15, 23, 42, 0.7);
                }
                .admin-form .btn-primary {
                    background: #d32f2f !important;
                    border-color: #d32f2f !important;
                    color: white;
                    padding: 12px;
                    border-radius: 10px;
                    font-weight: 700;
                    cursor: pointer;
                }
                .admin-form .btn-primary:hover {
                    background: #b71c1c !important;
                    border-color: #b71c1c !important;
                }
            `}</style>
        </div>
    );
};

export default AdminEmails;
