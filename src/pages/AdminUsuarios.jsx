import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminUsuarios = () => {
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [pushModalOpen, setPushModalOpen] = useState(false);
    const [pushTitle, setPushTitle] = useState('');
    const [pushMessage, setPushMessage] = useState('');
    const [pushLoading, setPushLoading] = useState(false);

    const loadUsuarios = async () => {
        setLoading(true);
        try {
            const data = await api.adminGetUsuarios();
            setUsuarios(data);
        } catch (err) {
            toast.error('Error al cargar usuarios');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsuarios();
    }, []);

    const handleToggleBlock = async (userId, currentStatus) => {
        const newStatus = !currentStatus;
        const confirmMsg = newStatus 
            ? '¿Estás seguro de que deseas BLOQUEAR a este usuario? No podrá iniciar sesión.' 
            : '¿Deseas DESBLOQUEAR a este usuario?';
        
        if (!window.confirm(confirmMsg)) return;

        try {
            await api.adminToggleBloqueoUsuario(userId, newStatus);
            toast.success(newStatus ? 'Usuario bloqueado' : 'Usuario desbloqueado');
            loadUsuarios();
        } catch (err) {
            toast.error('Error al cambiar estado de bloqueo');
        }
    };

    const handleDeleteAccount = async (userId) => {
        if (!window.confirm('¿ELIMINAR CUENTA? Esta acción no se puede deshacer y borrará todos los datos del usuario.')) return;
        
        try {
            await api.deleteUsuarioAccount(userId);
            toast.success('Usuario eliminado');
            loadUsuarios();
        } catch (err) {
            toast.error('Error al eliminar usuario');
        }
    };

    const filteredUsers = usuarios.filter(u => 
        u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.telefono?.includes(searchTerm)
    );

    if (loading) return <div className="loading-state">Cargando usuarios...</div>;

    const handleSendMassivePush = async () => {
        if (!pushTitle || !pushMessage) {
            toast.error("Completá título y mensaje");
            return;
        }
        if (!window.confirm("¿Seguro que deseas enviar esta notificación Push a TODOS los usuarios de la app?")) return;
        
        setPushLoading(true);
        try {
            const pushTokens = usuarios
                .filter(u => u.onesignal_id)
                .map(u => u.onesignal_id);
            
            if (pushTokens.length === 0) {
                toast.error("Ningún usuario tiene la app instalada o permisos aceptados.");
                setPushLoading(false);
                return;
            }

            await api.sendPushNotification({
                subscriptionIds: pushTokens,
                title: pushTitle,
                message: pushMessage,
                url: 'https://wepi.com.ar/pedir',
                data: { type: 'marketing' }
            });

            toast.success(`Notificación enviada a ${pushTokens.length} dispositivos.`);
            setPushModalOpen(false);
            setPushTitle('');
            setPushMessage('');
        } catch (err) {
            console.error(err);
            toast.error("Error al enviar notificaciones masivas");
        } finally {
            setPushLoading(false);
        }
    };

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header">
                <h2>Gestión de Usuarios</h2>
                <div className="header-actions">
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, email o tel..." 
                        className="filter-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '250px' }}
                    />
                    <button className="btn btn-warning" onClick={() => setPushModalOpen(true)}>Enviar Aviso (Push)</button>
                    <button className="btn btn-primary" onClick={loadUsuarios}>Refrescar</button>
                </div>
            </header>

            {pushModalOpen && (
                <div className="modal-overlay" onClick={() => setPushModalOpen(false)} style={{ zIndex: 9999 }}>
                    <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <h3>Enviar Push de Marketing</h3>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '15px' }}>
                            Se enviará una notificación a todos los celulares que tengan la app instalada.
                        </p>
                        <div className="form-group">
                            <label>Título del Aviso</label>
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="Ej: ¡Envío Gratis Hoy! 🛵"
                                value={pushTitle}
                                onChange={e => setPushTitle(e.target.value)}
                            />
                        </div>
                        <div className="form-group" style={{ marginTop: '10px' }}>
                            <label>Mensaje</label>
                            <textarea 
                                className="form-control" 
                                rows="3"
                                placeholder="Ej: Pedí ahora con envío gratis en todos los locales usando el código..."
                                value={pushMessage}
                                onChange={e => setPushMessage(e.target.value)}
                            ></textarea>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button className="btn btn-primary" onClick={handleSendMassivePush} disabled={pushLoading}>
                                {pushLoading ? 'Enviando...' : 'Enviar a todos'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setPushModalOpen(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Usuario</th>
                            <th>Contacto</th>
                            <th>Dirección</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No se encontraron usuarios.</td></tr>
                        ) : (
                            filteredUsers.map(u => (
                                <tr key={u.id} className={u.bloqueado ? 'row-blocked' : ''}>
                                    <td style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{u.id}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Registrado: {new Date(u.created_at).toLocaleDateString()}</div>
                                    </td>
                                    <td>
                                        <div>{u.email}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{u.telefono}</div>
                                    </td>
                                    <td style={{ maxWidth: '200px', fontSize: '0.85rem' }}>{u.direccion || 'N/A'}</td>
                                    <td>
                                        <span className={`badge ${u.bloqueado ? 'badge-danger' : 'badge-success'}`} style={{ color: u.bloqueado ? '#ef4444' : '#10b981' }}>
                                            {u.bloqueado ? 'Bloqueado' : 'Activo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                className={`btn btn-sm ${u.bloqueado ? 'btn-success' : 'btn-warning'}`}
                                                onClick={() => handleToggleBlock(u.id, u.bloqueado)}
                                                title={u.bloqueado ? 'Desbloquear' : 'Bloquear'}
                                            >
                                                {u.bloqueado ? 'Desbloquear' : 'Bloquear'}
                                            </button>
                                            <button 
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDeleteAccount(u.id)}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
                .row-blocked {
                    background-color: #fff1f2;
                    opacity: 0.8;
                }
                .filter-input {
                    padding: 8px 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.875rem;
                }
                .btn-warning {
                    background-color: #f59e0b;
                    color: white;
                }
                .btn-warning:hover {
                    background-color: #d97706;
                }
            `}} />
        </div>
    );
};

export default AdminUsuarios;
