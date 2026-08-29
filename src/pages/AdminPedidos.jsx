import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabase';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminPedidos = () => {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [localFilter, setLocalFilter] = useState('Todos');
    const [cityFilter, setCityFilter] = useState('Todos');
    const [dateStartFilter, setDateStartFilter] = useState('');
    const [dateEndFilter, setDateEndFilter] = useState('');
    const [limit, setLimit] = useState(10);
    const [locales, setLocales] = useState([]);
    
    // Modal state
    const [selectedPedido, setSelectedPedido] = useState(null);
    const [pedidoDetalle, setPedidoDetalle] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [forceMode, setForceMode] = useState(false);
    const [userCrmHistory, setUserCrmHistory] = useState([]);
    const [allRepartidores, setAllRepartidores] = useState([]);

    const loadRepartidores = async () => {
        try {
            const reps = await api.adminGetRepartidoresDetallado();
            setAllRepartidores(reps || []);
        } catch (err) {
            console.error('Error al cargar repartidores:', err);
        }
    };

    const loadPedidos = async () => {
        setLoading(true);
        try {
            const data = await api.adminGetPedidosGeneral(dateStartFilter, dateEndFilter, limit);
            setPedidos(data);
            
            // Fetch locales for filter
            const localesData = await api.adminGetLocales();
            setLocales(localesData.filter(l => l.admin_status === 'Aceptado'));
        } catch (err) {
            toast.error('Error al cargar pedidos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPedidos();
    }, [dateStartFilter, dateEndFilter, limit]);

    useEffect(() => {
        loadRepartidores();
    }, []);

    const handleOpenDetail = async (id) => {
        setModalLoading(true);
        setSelectedPedido(id);
        setUserCrmHistory([]);
        try {
            const detalle = await api.adminGetPedidoDetalle(id);
            setPedidoDetalle(detalle);
            if (detalle?.user_id) {
                const { data } = await supabase.from('crm_history').select('*').eq('usuario_id', detalle.user_id).order('created_at', { ascending: false }).limit(3);
                setUserCrmHistory(data || []);
            }
        } catch (err) {
            toast.error('Error al cargar detalle del pedido');
            setSelectedPedido(null);
        } finally {
            setModalLoading(false);
        }
    };

    const handleCloseModal = () => {
        setSelectedPedido(null);
        setPedidoDetalle(null);
        setUserCrmHistory([]);
        setForceMode(false);
    };

    const handleUpdateStatus = async (pedidoId, newStatus) => {
        if (forceMode) {
            if (!window.confirm(`⚠️ ADVERTENCIA: ¿Seguro que deseas FORZAR el cambio de estado a "${newStatus}"? Esto saltará las restricciones de la base de datos.`)) return;
        } else {
            if (!window.confirm(`¿Cambiar estado a ${newStatus}?`)) return;
        }
        try {
            if (forceMode) {
                await api.adminForceUpdatePedidoStatus(pedidoId, newStatus);
            } else {
                await api.adminUpdatePedidoStatus(pedidoId, newStatus);
            }
            toast.success(forceMode ? 'Estado forzado con éxito' : 'Estado actualizado');
            setPedidoDetalle(prev => ({ ...prev, estado: newStatus }));
            loadPedidos();
        } catch (err) {
            console.error(err);
            toast.error('Error al actualizar estado: ' + (err.message || 'Error desconocido'));
        }
    };

    const formatFecha = (fechaStr) => {
        if (!fechaStr) return 'N/A';
        const date = new Date(fechaStr);
        // Ajustar +3 horas para compensar el almacenamiento en UTC-3 que JS interpreta como UTC
        date.setHours(date.getHours() + 3);
        return date.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const filteredPedidos = pedidos.filter(p => {
        const matchesSearch = 
            p.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.num_confirmacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.includes(searchTerm);
        const matchesStatus = statusFilter === 'Todos' || p.estado === statusFilter;
        const matchesLocal = localFilter === 'Todos' || p.local_id === localFilter;
        const matchesCity = cityFilter === 'Todos' || p.locales?.ciudad === cityFilter;
        return matchesSearch && matchesStatus && matchesLocal && matchesCity;
    });

    if (loading) return <div className="loading-state">Cargando pedidos...</div>;

    const estadosPosibles = ['Buscando Repartidor', 'Pendiente de Pago', 'Pendiente', 'Confirmado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Entregado', 'Rechazado', 'Cancelado'];
    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-start' }}>
                <div className="header-info" style={{ minWidth: '200px' }}>
                    <h2>Historial de Pedidos</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{filteredPedidos.length} pedidos encontrados</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-start' }}>
                    <input 
                        type="text" 
                        placeholder="Buscar ID o Cliente..." 
                        className="filter-input"
                        style={{ maxWidth: '180px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Desde:</span>
                        <input 
                            type="date" 
                            className="filter-input"
                            style={{ maxWidth: '130px', padding: '0.5rem' }}
                            value={dateStartFilter}
                            onChange={(e) => setDateStartFilter(e.target.value)}
                            title="Fecha inicio"
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Hasta:</span>
                        <input 
                            type="date" 
                            className="filter-input"
                            style={{ maxWidth: '130px', padding: '0.5rem' }}
                            value={dateEndFilter}
                            onChange={(e) => setDateEndFilter(e.target.value)}
                            title="Fecha fin"
                        />
                    </div>
                    <select 
                        className="filter-select"
                        style={{ minWidth: 'auto', maxWidth: '160px', padding: '0.5rem' }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="Todos">Todos los estados</option>
                        {estadosPosibles.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>

                    <select 
                        className="filter-select"
                        style={{ minWidth: 'auto', maxWidth: '160px', padding: '0.5rem' }}
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                    >
                        <option value="Todos">Todas las ciudades</option>
                        <option value="Santo Tomé">Santo Tomé</option>
                        <option value="Oberá">Oberá</option>
                    </select>

                    <select 
                        className="filter-select"
                        style={{ minWidth: 'auto', maxWidth: '180px', padding: '0.5rem' }}
                        value={localFilter}
                        onChange={(e) => setLocalFilter(e.target.value)}
                    >
                        <option value="Todos">Todos los locales</option>
                        {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Cargar:</span>
                        <select 
                            className="filter-select"
                            style={{ minWidth: 'auto', padding: '0.5rem' }}
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>

                    <button className="btn btn-primary" onClick={loadPedidos}>Refrescar</button>
                </div>
            </header>

            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Nro / ID</th>
                            <th>Cliente</th>
                            <th>Total</th>
                            <th>Estado</th>
                            <th>Repartidor</th>
                            <th>Fecha</th>
                            <th>Pago / Entrega</th>
                            <th>Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPedidos.length === 0 ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No hay pedidos que coincidan.</td></tr>
                        ) : (
                            filteredPedidos.map(p => (
                                <tr key={p.id}>
                                    <td>
                                        <div style={{ fontWeight: 700, color: 'var(--red-600)' }}>#{p.num_confirmacion || p.id.substring(0, 6)}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{p.id.substring(0, 13)}...</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
                                            🏢 {p.locales?.nombre || 'Local'} {p.locales?.ciudad && <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>({p.locales.ciudad})</span>}
                                        </div>
                                        <span style={{ 
                                            display: 'inline-block',
                                            fontSize: '0.65rem', 
                                            padding: '2px 6px', 
                                            borderRadius: '4px', 
                                            marginTop: '4px', 
                                            fontWeight: 'bold',
                                            color: p.locales?.tipo_servicio === 'shops' ? '#1d4ed8' : '#15803d',
                                            backgroundColor: p.locales?.tipo_servicio === 'shops' ? '#dbeafe' : '#dcfce7',
                                            border: `1px solid ${p.locales?.tipo_servicio === 'shops' ? '#bfdbfe' : '#bbf7d0'}`
                                        }}>
                                            {p.locales?.tipo_servicio === 'shops' ? '🛍️ Shops' : '🛵 Delivery'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{p.nombre_cliente}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>{p.usuarios?.telefono || p.email_cliente || 'Sin contacto'}</span>
                                            {p.usuarios?.telefono && (
                                                <a 
                                                    href={`https://wa.me/${p.usuarios.telefono.replace(/[^\d]/g, '')}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    style={{ textDecoration: 'none' }}
                                                >
                                                    <span style={{ 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center',
                                                        backgroundColor: '#25D366', 
                                                        color: 'white', 
                                                        borderRadius: '4px', 
                                                        padding: '1px 5px', 
                                                        fontSize: '0.65rem', 
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer'
                                                    }}>
                                                        💬 WA
                                                    </span>
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>${Number(p.total).toLocaleString('es-AR')}</div>
                                    </td>
                                    <td>
                                        <span className={`badge ${p.estado?.toLowerCase().replace(' ', '-')}`}>
                                            {p.estado || 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        {p.repartidores ? (
                                            <div style={{ fontSize: '0.8rem' }}>
                                                <div style={{ fontWeight: 600, color: '#166534' }}>{p.repartidores.nombre}</div>
                                                <div style={{ color: '#64748b' }}>{p.repartidores.telefono}</div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No asignado</div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>{formatFecha(p.created_at || p.fecha)}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.75rem' }}>
                                            <div>{p.metodo_pago === 'mercadopago' ? '💳 MP' : '💵 EF'}</div>
                                            <div style={{ color: '#64748b' }}>{p.tipo_entrega}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <button className="btn btn-sm btn-outline" onClick={() => handleOpenDetail(p.id)}>
                                            Ver más
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Detalle */}
            {selectedPedido && createPortal(
                <div className="admin-modal-overlay" onClick={handleCloseModal}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={handleCloseModal}>×</button>
                        
                        {modalLoading ? (
                            <div className="loading-state">Cargando detalles...</div>
                        ) : pedidoDetalle ? (
                            <div className="pedido-deep-detail">
                                <header className="detail-header">
                                    <div className="badge-status-large">
                                        <span className={`badge ${pedidoDetalle.estado?.toLowerCase().replace(' ', '-')}`}>
                                            {pedidoDetalle.estado}
                                        </span>
                                    </div>
                                    <h3>Pedido #{pedidoDetalle.num_confirmacion || pedidoDetalle.id.substring(0, 8)}</h3>
                                    <p>{formatFecha(pedidoDetalle.created_at)}</p>
                                </header>

                                <div className="detail-grid">
                                    <section className="detail-section">
                                        <h4>👤 Cliente</h4>
                                        <p><strong>Nombre:</strong> {pedidoDetalle.nombre_cliente}</p>
                                        <p style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '6px 0' }}>
                                            <strong>Contacto:</strong> {pedidoDetalle.usuarios?.telefono || 'No disponible'}
                                            {pedidoDetalle.usuarios?.telefono && (
                                                <a 
                                                    href={`https://wa.me/${pedidoDetalle.usuarios.telefono.replace(/[^\d]/g, '')}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    style={{ textDecoration: 'none' }}
                                                >
                                                    <span style={{ 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center',
                                                        backgroundColor: '#25D366', 
                                                        color: 'white', 
                                                        borderRadius: '4px', 
                                                        padding: '1px 5px', 
                                                        fontSize: '0.65rem', 
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer'
                                                    }}>
                                                        💬 WA
                                                    </span>
                                                </a>
                                            )}
                                        </p>
                                        <p><strong>Email:</strong> {pedidoDetalle.email_cliente}</p>
                                        <p><strong>Dirección:</strong> {pedidoDetalle.direccion}</p>
                                        {pedidoDetalle.observaciones && (
                                            <p className="obs-box"><strong>Obs:</strong> {pedidoDetalle.observaciones}</p>
                                        )}
                                    </section>

                                    <section className="detail-section">
                                        <h4>💳 Pago y Entrega</h4>
                                        <p><strong>Método:</strong> {pedidoDetalle.metodo_pago.toUpperCase()}</p>
                                        <p><strong>Entrega:</strong> {pedidoDetalle.tipo_entrega}</p>
                                        <p><strong>Total:</strong> <span className="total-price">${Number(pedidoDetalle.total).toLocaleString('es-AR')}</span></p>
                                        <p><strong>PIN de Entrega:</strong> <span style={{ color: 'var(--red-600)', fontWeight: 'bold', fontSize: '1.1rem' }}>{pedidoDetalle.num_confirmacion || 'N/A'}</span></p>
                                        {(() => {
                                            const orderCity = pedidoDetalle?.locales_info?.[0]?.locales?.ciudad || 'Santo Tomé';
                                            const repartidoresFiltrados = allRepartidores.filter(rep => 
                                                rep.admin_status === 'Aceptado' && 
                                                rep.ciudad === orderCity
                                            );
                                            return (
                                                <div className="driver-assign-box" style={{ marginTop: '10px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                    <p style={{ margin: '0 0 8px 0', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>🛵 Repartidor Asignado:</p>
                                                    
                                                    {pedidoDetalle.repartidores ? (
                                                        <div style={{ marginBottom: '8px', fontSize: '0.9rem' }}>
                                                            <strong>{pedidoDetalle.repartidores.nombre}</strong> ({pedidoDetalle.repartidores.telefono || 'Sin teléfono'})
                                                        </div>
                                                    ) : (
                                                        <div style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#94a3b8', fontStyle: 'italic' }}>Ningún repartidor asignado</div>
                                                    )}

                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <select
                                                            className="filter-select"
                                                            style={{ flex: 1, height: '36px', fontSize: '0.85rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                                            value={pedidoDetalle.repartidor_id || ''}
                                                            onChange={async (e) => {
                                                                const newDriverId = e.target.value;
                                                                if (window.confirm('¿Cambiar el repartidor asignado a este pedido?')) {
                                                                    try {
                                                                        await api.adminAssignRepartidor(pedidoDetalle.id, newDriverId || null);
                                                                        toast.success('Repartidor actualizado');
                                                                        handleOpenDetail(pedidoDetalle.id);
                                                                        loadPedidos();
                                                                    } catch (err) {
                                                                        toast.error('Error al asignar repartidor: ' + err.message);
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <option value="">-- Sin asignar / Remover --</option>
                                                            {repartidoresFiltrados.map(rep => (
                                                                <option key={rep.id} value={rep.id}>
                                                                    {rep.nombre} ({rep.email})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Tiempos Cronometrados */}
                                        <div className="driver-info-box" style={{ marginTop: '10px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                                            <p style={{ margin: '0 0 8px 0', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>⏱️ Tiempos de Control:</p>
                                            <p style={{ margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Preparación:</span>
                                                <strong>
                                                    {pedidoDetalle.tiempo_preparacion !== null && pedidoDetalle.tiempo_preparacion !== undefined ? (
                                                        `${Math.round(pedidoDetalle.tiempo_preparacion / 60)} min`
                                                     ) : (
                                                        <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>En curso...</span>
                                                     )}
                                                </strong>
                                            </p>
                                            <p style={{ margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Retiro (Listo ➔ Retirado):</span>
                                                <strong>
                                                    {pedidoDetalle.tiempo_retiro !== null && pedidoDetalle.tiempo_retiro !== undefined ? (
                                                        `${Math.round(pedidoDetalle.tiempo_retiro / 60)} min`
                                                     ) : (
                                                        <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>En curso...</span>
                                                     )}
                                                </strong>
                                            </p>
                                            <p style={{ margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Entrega (Retirado ➔ Entregado):</span>
                                                <strong>
                                                    {pedidoDetalle.tiempo_entrega !== null && pedidoDetalle.tiempo_entrega !== undefined ? (
                                                        `${Math.round(pedidoDetalle.tiempo_entrega / 60)} min`
                                                     ) : (
                                                        <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>En curso...</span>
                                                     )}
                                                </strong>
                                            </p>
                                        </div>
                                        {pedidoDetalle.payment_id && (
                                            <div className="mp-info">
                                                <p><strong>MP ID:</strong> {pedidoDetalle.payment_id}</p>
                                                {pedidoDetalle.payment_metadata && (
                                                    <p><strong>Tarjeta:</strong> {pedidoDetalle.payment_metadata.card_brand} **** {pedidoDetalle.payment_metadata.last_four}</p>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                </div>
                                
                                {userCrmHistory.length > 0 && (
                                    <div className="crm-history-box" style={{ marginTop: '16px', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.9rem' }}>
                                        <p style={{ margin: '0 0 8px 0', fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>📢 Campañas Recientes a este usuario:</p>
                                        <ul style={{ paddingLeft: '20px', margin: 0, color: '#b45309' }}>
                                            {userCrmHistory.map(hist => (
                                                <li key={hist.id} style={{ marginBottom: '4px' }}>
                                                    <strong>{hist.detalle || hist.tipo}</strong> — 
                                                    <span style={{ fontSize: '0.8rem', marginLeft: '6px' }}>
                                                        {new Date(hist.created_at).toLocaleString()}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <section className="detail-section items-section">
                                    <h4>📦 Detalle por Local</h4>
                                    {pedidoDetalle.locales_info && pedidoDetalle.locales_info.map(li => {
                                        const localItems = pedidoDetalle.items.filter(item => item.local_id === li.local_id);
                                        return (
                                            <div key={li.id} style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <h5 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>🏢 {li.locales?.nombre}</h5>
                                                        <span style={{ 
                                                            display: 'inline-block',
                                                            fontSize: '0.65rem', 
                                                            padding: '2px 6px', 
                                                            borderRadius: '4px', 
                                                            fontWeight: 'bold',
                                                            color: li.locales?.tipo_servicio === 'shops' ? '#1d4ed8' : '#15803d',
                                                            backgroundColor: li.locales?.tipo_servicio === 'shops' ? '#dbeafe' : '#dcfce7',
                                                            border: `1px solid ${li.locales?.tipo_servicio === 'shops' ? '#bfdbfe' : '#bbf7d0'}`
                                                        }}>
                                                            {li.locales?.tipo_servicio === 'shops' ? '🛍️ Shops' : '🛵 Delivery'}
                                                        </span>
                                                    </div>
                                                    <span className={`badge ${li.estado?.toLowerCase().replace(' ', '-')}`}>{li.estado}</span>
                                                </div>
                                                <table className="items-table" style={{ background: 'transparent', boxShadow: 'none', margin: 0 }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '50px' }}>Cant</th>
                                                            <th>Producto</th>
                                                            <th style={{ textAlign: 'right' }}>Unit.</th>
                                                            <th style={{ textAlign: 'right' }}>Subtotal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {localItems.map(item => (
                                                            <tr key={item.id}>
                                                                <td>{item.cantidad}x</td>
                                                                <td>
                                                                    <div style={{ fontWeight: 600 }}>{item.nombre || item.nombre_item}</div>
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>${Number(item.precio_unitario).toLocaleString('es-AR')}</td>
                                                                <td style={{ textAlign: 'right' }}>${Number(item.subtotal).toLocaleString('es-AR')}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot style={{ borderTop: '1px dashed #cbd5e1' }}>
                                                        <tr>
                                                            <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600, padding: '12px 8px 0' }}>Total Local:</td>
                                                            <td style={{ textAlign: 'right', fontWeight: 800, padding: '12px 8px 0', color: '#1e293b' }}>${Number(li.total).toLocaleString('es-AR')}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        );
                                    })}
                                    
                                    <div style={{ 
                                        marginTop: '16px', 
                                        background: '#f1f5f9', 
                                        padding: '16px', 
                                        borderRadius: '12px', 
                                        border: '1px solid #e2e8f0' 
                                    }}>
                                        {pedidoDetalle.precio_envio > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '8px', fontSize: '0.9rem' }}>
                                                <span>Costo de Envío</span>
                                                <span>${Number(pedidoDetalle.precio_envio).toLocaleString('es-AR')}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 900, color: '#1e293b' }}>
                                            <span>TOTAL PEDIDO</span>
                                            <span>${Number(pedidoDetalle.total).toLocaleString('es-AR')}</span>
                                        </div>
                                    </div>
                                </section>

                                <footer className="detail-footer">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                                        <h4 style={{ margin: 0 }}>Acciones de Estado</h4>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', color: '#dc2626', fontWeight: 'bold' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={forceMode} 
                                                onChange={(e) => setForceMode(e.target.checked)} 
                                            />
                                            ⚠️ Modo Forzar (Desactivar seguros)
                                        </label>
                                    </div>
                                    <div className="action-buttons">
                                        {estadosPosibles.map(est => (
                                            <button 
                                                key={est} 
                                                className={`btn btn-sm ${pedidoDetalle.estado === est ? 'btn-primary' : 'btn-outline'}`}
                                                onClick={() => handleUpdateStatus(pedidoDetalle.id, est)}
                                                disabled={pedidoDetalle.estado === est}
                                            >
                                                {est}
                                            </button>
                                        ))}
                                    </div>
                                </footer>
                            </div>
                        ) : (
                            <p>No se pudo cargar la información.</p>
                        )}
                    </div>
                </div>,
                document.body
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .btn-outline {
                    background: transparent;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                }
                .btn-outline:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }
                .admin-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.85);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(8px);
                    padding: 20px;
                }
                .admin-modal-content {
                    background: white;
                    border-radius: 12px;
                    width: 100%;
                    max-width: 800px;
                    max-height: 90vh;
                    overflow-y: auto;
                    position: relative;
                    padding: 30px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                }
                .modal-close-btn {
                    position: absolute;
                    top: 15px; right: 15px;
                    border: none; background: #f1f5f9;
                    width: 30px; height: 30px;
                    border-radius: 50%; cursor: pointer;
                    font-size: 1.2rem; display: flex;
                    align-items: center; justify-content: center;
                }
                .pedido-deep-detail h3 { margin: 0; color: #1e293b; }
                .detail-header { text-align: center; margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; }
                .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
                .detail-section h4 { 
                    font-size: 0.8rem; text-transform: uppercase; 
                    letter-spacing: 0.05em; color: #94a3b8; 
                    margin-bottom: 12px; border-bottom: 2px solid #f8fafc;
                    display: inline-block;
                }
                .detail-section p { margin: 6px 0; font-size: 0.95rem; color: #334155; }
                .obs-box { background: #fffbeb; padding: 10px; border-radius: 6px; border: 1px solid #fef3c7; font-style: italic; }
                .total-price { font-size: 1.2rem; font-weight: 800; color: #10b981; }
                .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .items-table th { text-align: left; font-size: 0.75rem; color: #64748b; padding: 10px; border-bottom: 1px solid #f1f5f9; }
                .items-table td { padding: 10px; border-bottom: 1px solid #f8fafc; font-size: 0.9rem; }
                .items-table tfoot td { font-weight: 800; padding-top: 15px; border-bottom: none; }
                .action-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
                .mp-info { margin-top: 10px; padding: 10px; background: #f0f9ff; border-radius: 6px; border: 1px solid #e0f2fe; font-size: 0.85rem; }
            `}} />
        </div>
    );
};

export default AdminPedidos;
