import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

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

    useEffect(() => {
        const loadCities = async () => {
            try {
                const data = await api.getCiudadesConfig();
                setCities(data || []);
                if (data && data.length > 0) {
                    setSelectedCity(data[0].ciudad);
                }
            } catch (err) {
                console.error('Error fetching cities:', err);
            }
        };
        loadCities();
    }, []);

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
                        <a href="${buttonUrl}" style="display: inline-block; padding: 14px 28px; background-color: #d32f2f; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
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
                manualList = manualEmails.split(/[\s,]+/).filter(e => e.includes('@'));
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
                ciudad: target === 'usuarios_ciudad' ? selectedCity : null
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

    return (
        <div className="panel-card animate-fade-in" style={{ maxWidth: '800px' }}>
            <header className="panel-header">
                <h2>Panel de Marketing & Avisos</h2>
            </header>

            <form onSubmit={handleSend} className="admin-form">
                <div className="form-group">
                    <label>Enviar a:</label>
                    <select value={target} onChange={(e) => setTarget(e.target.value)} className="form-control">
                        <option value="usuarios">Todos los Usuarios</option>
                        <option value="usuarios_ciudad">Usuarios por Ciudad</option>
                        <option value="locales">Todos los Locales</option>
                        <option value="repartidores">Todos los Repartidores</option>
                        <option value="lanzamiento">Hoja de Lanzamiento (Supabase)</option>
                        <option value="manual">Manual (Ingresar emails)</option>
                    </select>
                </div>

                {target === 'usuarios_ciudad' && (
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
                        placeholder="Ej: ¡Nueva promoción disponible! 🍔"
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

                <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
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
                            placeholder="https://wepi.com.ar/..."
                        />
                    </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={sending} style={{ width: '100%', marginTop: '1rem' }}>
                    {sending ? 'Enviando...' : '🚀 Enviar Ahora'}
                </button>
            </form>

            <style>{`
                .admin-form .form-group { margin-bottom: 1.5rem; }
                .admin-form label { display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #94a3b8; font-weight: 500; }
                .admin-form .form-control {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border-radius: 0.75rem;
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    font-size: 1rem;
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
