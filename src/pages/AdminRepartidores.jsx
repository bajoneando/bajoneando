import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import AdminPagos from './AdminPagos';

const AdminRepartidores = () => {
    const [repartidores, setRepartidores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('gestion');
    const [settlements, setSettlements] = useState([]);
    const [settlementsLoading, setSettlementsLoading] = useState(false);
    const [repFilter, setRepFilter] = useState('Todos');
    const [selectedSettleIds, setSelectedSettleIds] = useState([]);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [generatedMessage, setGeneratedMessage] = useState('');
    const [finanzasSubTab, setFinanzasSubTab] = useState('liquidacion'); // 'liquidacion' or 'calendario'
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [calendarPayments, setCalendarPayments] = useState([]);
    const [isCalendarLoading, setIsCalendarLoading] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [newPayment, setNewPayment] = useState({ repartidor_id: '', monto: '', nota: '', pedido_ids: '' });
    const [pendingSettlementsForModal, setPendingSettlementsForModal] = useState([]);
    const [selectedOrderIdsInModal, setSelectedOrderIdsInModal] = useState([]);
    const [allScheduledOrderIds, setAllScheduledOrderIds] = useState([]);

    // Priority Modal State
    const [showPriorityModal, setShowPriorityModal] = useState(false);
    const [selectedRep, setSelectedRep] = useState(null);
    const [allLocales, setAllLocales] = useState([]);
    const [tempPriorities, setTempPriorities] = useState([]);
    const [isSavingPriority, setIsSavingPriority] = useState(false);

    const loadRepartidores = async () => {
        setLoading(true);
        try {
            const data = await api.adminGetRepartidoresDetallado();
            // Sort: Aceptado -> Pendiente -> Rechazado
            const sorted = data.sort((a, b) => {
                const order = { 'Aceptado': 1, 'Pendiente': 2, 'Rechazado': 3 };
                return (order[a.admin_status] || 4) - (order[b.admin_status] || 4);
            });
            setRepartidores(sorted);
        } catch (err) {
            toast.error('Error al cargar repartidores');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateVehicle = async (repId, field, value) => {
        try {
            await api.repartidorUpdatePerfil({ driverId: repId, [field]: value });
            toast.success('Actualizado correctamente');
            loadRepartidores();
        } catch (err) {
            toast.error('Error al actualizar');
        }
    };

    const [rubrosConfig, setRubrosConfig] = useState([]);
    const [loadingRubros, setLoadingRubros] = useState(false);

    const loadRubrosConfig = async () => {
        setLoadingRubros(true);
        try {
            const data = await api.getRubrosConfig();
            setRubrosConfig(data);
        } catch (err) {
            toast.error('Error al cargar rubros');
        } finally {
            setLoadingRubros(false);
        }
    };

    const handleUpdateRubro = async (id, field, value) => {
        try {
            await api.updateRubroConfig(id, { [field]: value });
            toast.success('Rubro actualizado');
            loadRubrosConfig();
        } catch (err) {
            toast.error('Error al actualizar rubro');
        }
    };

    useEffect(() => {
        loadRepartidores();
        loadLocales();
        if (activeTab === 'rubros') {
            loadRubrosConfig();
        }
        if (activeTab === 'finanzas') {
            if (finanzasSubTab === 'liquidacion') {
                loadSettlements();
                loadAllScheduledOrderIds();
            }
            else loadCalendarPayments();
        }
        // Polling cada 30 segundos para actualizar actividad en tiempo real
        const interval = setInterval(loadRepartidores, 30000);
        return () => clearInterval(interval);
    }, [activeTab, finanzasSubTab, calendarDate]);

    useEffect(() => {
        if (showPaymentModal && newPayment.repartidor_id) {
            loadPendingSettlementsForModal();
        } else {
            setPendingSettlementsForModal([]);
            setSelectedOrderIdsInModal([]);
        }
    }, [newPayment.repartidor_id, showPaymentModal]);

    const loadPendingSettlementsForModal = async () => {
        try {
            const data = await api.adminGetDriverPendingSettlements(newPayment.repartidor_id);
            setPendingSettlementsForModal(data);
        } catch (err) {
            console.error("Error loading pending settlements for modal", err);
        }
    };

    const handleToggleOrderInModal = (id) => {
        const newSelected = selectedOrderIdsInModal.includes(id)
            ? selectedOrderIdsInModal.filter(i => i !== id)
            : [...selectedOrderIdsInModal, id];
        
        setSelectedOrderIdsInModal(newSelected);
        
        // Calculate total amount
        const total = pendingSettlementsForModal
            .filter(s => newSelected.includes(s.id))
            .reduce((sum, s) => sum + Number(s.precio_envio || 0), 0);
        
        setNewPayment(prev => ({ ...prev, monto: total, pedido_ids: newSelected.join(',') }));
    };

    const loadCalendarPayments = async () => {
        setIsCalendarLoading(true);
        try {
            const data = await api.adminGetDriverPayments(calendarDate.getMonth(), calendarDate.getFullYear());
            setCalendarPayments(data);
        } catch (err) {
            toast.error('Error al cargar pagos del calendario');
        } finally {
            setIsCalendarLoading(false);
        }
    };

    const handleCreatePayment = async () => {
        if (!newPayment.repartidor_id || !newPayment.monto || !selectedDate) {
            toast.error('Completa todos los campos obligatorios');
            return;
        }
        try {
            await api.adminCreateDriverPayment({
                ...newPayment,
                fecha: selectedDate,
                monto: Number(newPayment.monto)
            });
            toast.success('Pago registrado');
            setShowPaymentModal(false);
            setNewPayment({ repartidor_id: '', monto: '', nota: '' });
            loadCalendarPayments();
        } catch (err) {
            toast.error('Error al registrar pago');
        }
    };

    const handleDeletePayment = async (id) => {
        if (!window.confirm('¿Eliminar este registro de pago?')) return;
        try {
            await api.adminDeleteDriverPayment(id);
            toast.success('Pago eliminado');
            loadCalendarPayments();
        } catch (err) {
            toast.error('Error al eliminar pago');
        }
    };

    const handleJumpToSettlement = (payment) => {
        setFinanzasSubTab('liquidacion');
        setRepFilter(payment.repartidor_id);
        if (payment.pedido_ids) {
            const ids = payment.pedido_ids.split(',').map(id => id.trim()).filter(Boolean);
            setSelectedSettleIds(ids);
        } else {
            setSelectedSettleIds([]);
        }
        loadAllScheduledOrderIds();
    };

    const loadAllScheduledOrderIds = async () => {
        try {
            const payments = await api.adminGetDriverPaymentsAll();
            const ids = payments.flatMap(p => p.pedido_ids ? p.pedido_ids.split(',') : []).map(id => id.trim()).filter(Boolean);
            setAllScheduledOrderIds(ids);
        } catch (err) {
            console.error("Error loading scheduled order ids", err);
        }
    };

    const handleCopyCalendarSummary = (payment) => {
        const numPedidos = payment.pedido_ids ? payment.pedido_ids.split(',').map(id => id.trim()).filter(Boolean).length : 0;
        
        // Format date from YYYY-MM-DD to DD-MM-YYYY
        const [year, month, day] = payment.fecha.split('-');
        const formattedDate = `${day}-${month}-${year}`;

        const summary = `Próximo pago\n\nFecha: ${formattedDate}\nHorario: 23:00 hs\nCantidad de pedidos: ${numPedidos}\nTotal: $${Number(payment.monto).toLocaleString('es-AR')}`;
        
        navigator.clipboard.writeText(summary);
        toast.success('Resumen copiado');
    };

    const loadLocales = async () => {
        try {
            const data = await api.getLocales();
            setAllLocales(data);
        } catch (err) {
            console.error("Error loading locales:", err);
        }
    };

    const loadSettlements = async () => {
        setSettlementsLoading(true);
        try {
            const data = await api.adminGetDriverSettlements();
            setSettlements(data);
        } catch (err) {
            toast.error('Error al cargar liquidaciones');
        } finally {
            setSettlementsLoading(false);
        }
    };

    const handleTogglePaymentStatus = async (pedidoId, currentStatus) => {
        try {
            await api.adminUpdateDriverPaymentStatus(pedidoId, !currentStatus);
            toast.success('Estado de pago actualizado');
            loadSettlements();
        } catch (err) {
            toast.error('Error al actualizar estado de pago');
        }
    };

    const toggleSelection = (id) => {
        setSelectedSettleIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (filteredSettlements) => {
        const allFilteredIds = filteredSettlements.map(s => s.id);
        if (selectedSettleIds.length === allFilteredIds.length) {
            setSelectedSettleIds([]);
        } else {
            setSelectedSettleIds(allFilteredIds);
        }
    };

    const getFilteredSettlements = () => {
        if (repFilter === 'Todos') {
            return settlements;
        }
        const selDriver = repartidores.find(r => r.id === repFilter);
        if (selDriver && selDriver.es_partner) {
            const linkedIds = repartidores
                .filter(r => r.partner_id === selDriver.id || r.id === selDriver.id)
                .map(r => r.id);
            return settlements.filter(s => linkedIds.includes(s.repartidor_id));
        }
        return settlements.filter(s => s.repartidor_id === repFilter);
    };     const handleGenerateMessage = () => {
        if (selectedSettleIds.length === 0) return;
        
        const selectedData = settlements.filter(s => selectedSettleIds.includes(s.id));
        const selDriver = repartidores.find(r => r.id === repFilter);
        const isPartnerSelected = selDriver && selDriver.es_partner;
        const targetName = isPartnerSelected ? selDriver.nombre : (selectedData[0]?.repartidores?.nombre || 'Repartidor');
        
        let msg = `Hola ${targetName}, te envío la liquidación de tus pedidos de hoy:\n\n`;
        let totalTransferir = 0;
        
        selectedData.forEach(s => {
            const amount = Number(s.precio_envio || 0);
            const isCash = s.metodo_pago === 'Efectivo';
            const isProcessed = s.cobro_repartidor_procesado;
            
            let note = '';
            if (isCash) note = ' (Efectivo - Ya pagado)';
            else if (isProcessed) note = ' (Ya saldado)';

            const driverSuffix = isPartnerSelected 
                ? ` repartidor ${s.repartidores?.nombre || s.repartidor_id || 'N/A'}` 
                : '';

            msg += `- #${s.id.substring(0, 8)} (${new Date(s.created_at).toLocaleDateString()}): $${amount.toLocaleString('es-AR')}${note}${driverSuffix}\n`;
            
            if (!isProcessed && !isCash) {
                totalTransferir += amount;
            }
        });
        
        msg += `\n*TOTAL A TRANSFERIR: $${totalTransferir.toLocaleString('es-AR')}*`;
        
        setGeneratedMessage(msg);
        setShowInvoiceModal(true);
    };

    const handleBulkMarkAsPaid = async () => {
        const toProcess = settlements.filter(s => selectedSettleIds.includes(s.id) && !s.cobro_repartidor_procesado);
        if (toProcess.length === 0) {
            toast.error('No hay pedidos pendientes para marcar como saldados');
            return;
        }
        if (!window.confirm(`¿Seguro que deseas marcar ${toProcess.length} pedidos como saldados?`)) return;
        
        try {
            await Promise.all(toProcess.map(s => api.adminUpdateDriverPaymentStatus(s.id, true)));
            toast.success(`${toProcess.length} pedidos actualizados`);
            setSelectedSettleIds([]);
            loadSettlements();
        } catch (err) {
            toast.error('Error al actualizar pedidos');
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.adminUpdateRepartidorStatus(id, status);
            toast.success(`Repartidor ${status}`);
            loadRepartidores();
        } catch (err) {
            toast.error('Error al actualizar estado');
        }
    };

    const handleToggleEstado = async (id, currentState) => {
        const newState = currentState === 'Inactivo' ? 'Activo' : 'Inactivo';
        if (!window.confirm(`¿Seguro que deseas cambiar el estado a ${newState}?`)) return;
        try {
            await api.adminUpdateRepartidorEstado(id, newState);
            toast.success(`Repartidor marcado como ${newState}`);
            loadRepartidores();
        } catch (err) {
            toast.error('Error al actualizar disponibilidad');
        }
    };

    const handleOpenPriorityModal = (rep) => {
        setSelectedRep(rep);
        setTempPriorities(rep.locales_prioridad || []);
        setShowPriorityModal(true);
    };

    const handleTogglePriority = (localId) => {
        setTempPriorities(prev => 
            prev.includes(localId) 
                ? prev.filter(id => id !== localId) 
                : [...prev, localId]
        );
    };

    const handleSavePriorities = async () => {
        setIsSavingPriority(true);
        try {
            await api.adminUpdateRepartidorPrioridad(selectedRep.id, tempPriorities);
            toast.success('Prioridades actualizadas correctamente');
            setShowPriorityModal(false);
            loadRepartidores();
        } catch (err) {
            toast.error('Error al guardar prioridades');
        } finally {
            setIsSavingPriority(false);
        }
    };

    const isOnline = (rep) => {
        if (!rep.ultima_actividad) return false;
        // La DB guarda en UTC. Comparamos directamente.
        const now = new Date();
        const diff = (now - new Date(rep.ultima_actividad)) / 1000 / 60;
        
        // Consideramos online si reportó actividad en los últimos 5 min y su estado es Activo/Ocupado
        return diff < 5 && (rep.estado === 'Activo' || rep.estado === 'Ocupado');
    };

    const formatLastActive = (date) => {
        if (!date) return 'Nunca';
        // El string viene en UTC desde la DB, JS lo convierte a local automáticamente
        const d = new Date(date);
        return d.toLocaleTimeString('es-AR', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    };

    const handleCopyAcceptedContacts = () => {
        const accepted = repartidores.filter(r => r.admin_status === 'Aceptado');
        const validPhones = accepted
            .map(r => r.telefono?.replace(/[\s-]/g, ''))
            .filter(phone => phone && phone.length > 5);

        if (validPhones.length === 0) {
            toast.error('No hay números válidos para copiar');
            return;
        }

        const stringList = validPhones.join(',');
        navigator.clipboard.writeText(stringList).then(() => {
            toast.success(`Se copiaron ${validPhones.length} números`);
        }).catch(err => {
            toast.error('Error al copiar');
            console.error(err);
        });
    };

    const handleCopyBroadcastTemplate = () => {
        const text = `*PEDIDOS PENDIENTES* en el panel

Tomalo ahora y genera ingresos extra wepi.com.ar/repartidores

_Este es un mensaje de difusión. No responder_`;
        
        navigator.clipboard.writeText(text).then(() => {
            toast.success('Mensaje copiado al portapapeles');
        }).catch(err => {
            toast.error('Error al copiar mensaje');
            console.error(err);
        });
    };

    if (loading) return <div className="loading-state">Cargando repartidores...</div>;

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header">
                <h2>Gestión de Repartidores</h2>
                <div className="admin-locales-tabs" style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        className={`tab-btn ${activeTab === 'gestion' ? 'active' : ''}`}
                        onClick={() => setActiveTab('gestion')}
                        style={{ padding: '8px 16px', background: activeTab === 'gestion' ? '#e2e8f0' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Gestión de Registros
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'pagos' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pagos')}
                        style={{ padding: '8px 16px', background: activeTab === 'pagos' ? '#e2e8f0' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Solicitudes
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'finanzas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('finanzas')}
                        style={{ padding: '8px 16px', background: activeTab === 'finanzas' ? '#e2e8f0' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Compensación
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'rubros' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rubros')}
                        style={{ padding: '8px 16px', background: activeTab === 'rubros' ? '#e2e8f0' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Config. Rubros
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-sm" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }} onClick={handleCopyBroadcastTemplate}>
                        💬 Copiar Mensaje
                    </button>
                    <button className="btn btn-sm" style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }} onClick={handleCopyAcceptedContacts}>
                        📋 Copiar Contactos
                    </button>
                    <button className="btn btn-primary" onClick={loadRepartidores}>Refrescar</button>
                </div>
            </header>
            
            {activeTab === 'gestion' ? (
                <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Contacto</th>
                            <th>Tipo Cuenta</th>
                            <th>Vehículo</th>
                            <th>Push</th>
                            <th>Disponibilidad</th>
                            <th>Activo</th>
                            <th>Estado Admin</th>
                            <th>Prioridad</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {repartidores.length === 0 ? (
                            <tr><td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>No hay repartidores registrados.</td></tr>
                        ) : (
                            repartidores.map(rep => (
                                <tr key={rep.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <img 
                                                src={rep.foto_url || 'https://placehold.co/40x40'} 
                                                alt="" 
                                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{rep.nombre}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{rep.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{rep.telefono}</td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '500' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={rep.es_partner || false} 
                                                    onChange={(e) => handleUpdateVehicle(rep.id, 'es_partner', e.target.checked)}
                                                />
                                                Partner Logístico
                                            </label>
                                            
                                            {/* Si es chofer regular, mostrar opción para vincular a un partner */}
                                            {rep.partner_id && (
                                                <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: '500' }}>
                                                    🔗 Vinculado a: {repartidores.find(r => r.id === rep.partner_id)?.nombre || 'Partner'}
                                                </span>
                                            )}
                                            {!rep.es_partner && (
                                                <div style={{ marginTop: '4px' }}>
                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Vincular a Partner:</span>
                                                    <select
                                                        value={rep.partner_id || ''}
                                                        onChange={(e) => handleUpdateVehicle(rep.id, 'partner_id', e.target.value || null)}
                                                        style={{ 
                                                            padding: '2px 4px', 
                                                            fontSize: '0.8rem', 
                                                            borderRadius: '4px',
                                                            width: '100%',
                                                            border: '1px solid #cbd5e1'
                                                        }}
                                                    >
                                                        <option value="">(Sin vincular / Indep.)</option>
                                                        {repartidores.filter(r => r.es_partner).map(p => (
                                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Si es partner logístico, mostrar su flota y opción para agregar choferes a su flota */}
                                            {rep.es_partner && (
                                                <>
                                                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#475569' }}>
                                                        <strong>Flota:</strong> {repartidores.filter(r => r.partner_id === rep.id).map(r => r.nombre).join(', ') || 'Ninguno'}
                                                    </div>
                                                    <div style={{ marginTop: '4px' }}>
                                                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Agregar a Flota:</span>
                                                        <select
                                                            value=""
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val) handleUpdateVehicle(val, 'partner_id', rep.id);
                                                            }}
                                                            style={{ 
                                                                padding: '2px 4px', 
                                                                fontSize: '0.8rem', 
                                                                borderRadius: '4px',
                                                                width: '100%',
                                                                border: '1px solid #cbd5e1'
                                                            }}
                                                        >
                                                            <option value="">-- Seleccionar Chofer --</option>
                                                            {repartidores.filter(r => !r.es_partner && r.partner_id !== rep.id).map(d => (
                                                                <option key={d.id} value={d.id}>
                                                                    {d.nombre} {d.partner_id ? `(De otro partner)` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <select 
                                                value={rep.tipo_vehiculo || 'Moto'} 
                                                onChange={(e) => handleUpdateVehicle(rep.id, 'tipo_vehiculo', e.target.value)}
                                                style={{ padding: '2px 4px', fontSize: '0.8rem', borderRadius: '4px' }}
                                            >
                                                <option value="Moto">🏍️ Moto</option>
                                                <option value="Bicicleta">🚲 Bici</option>
                                            </select>
                                            <select 
                                                value={rep.nivel_repartidor || 1} 
                                                onChange={(e) => handleUpdateVehicle(rep.id, 'nivel_repartidor', Number(e.target.value))}
                                                style={{ padding: '2px 4px', fontSize: '0.8rem', borderRadius: '4px' }}
                                            >
                                                <option value={1}>Nivel 1 (Cap 2)</option>
                                                <option value={2}>Nivel 2 (Cap 1)</option>
                                            </select>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span 
                                            title={rep.onesignal_id ? 'Suscribo a Notificaciones' : 'Sin Suscripción'} 
                                            style={{ fontSize: '1.2rem', filter: rep.onesignal_id ? 'none' : 'grayscale(1)' }}
                                        >
                                            {rep.onesignal_id ? '🔔' : '🔕'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--red-600)' }}>
                                                {rep.horario_apertura && rep.horario_cierre 
                                                    ? `${rep.horario_apertura} - ${rep.horario_cierre}` 
                                                    : 'Sin horario'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                {rep.dias_apertura && Array.isArray(rep.dias_apertura) 
                                                    ? rep.dias_apertura.join(', ') 
                                                    : 'Sin días asignados'}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={`badge ${isOnline(rep) ? 'success' : (rep.estado === 'Ocupado' ? 'warning' : 'secondary')}`}>
                                                {isOnline(rep) ? (rep.estado === 'Ocupado' ? 'Ocupado' : 'Online') : 'Offline'}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                Visto: {formatLastActive(rep.ultima_actividad)}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${rep.admin_status?.toLowerCase()}`}>
                                            {rep.admin_status || 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    className="btn btn-success btn-sm" 
                                                    onClick={() => handleUpdateStatus(rep.id, 'Aceptado')}
                                                    disabled={rep.admin_status === 'Aceptado'}
                                                >
                                                    Aceptar
                                                </button>
                                                <button 
                                                    className="btn btn-danger btn-sm" 
                                                    onClick={() => handleUpdateStatus(rep.id, 'Rechazado')}
                                                    disabled={rep.admin_status === 'Rechazado'}
                                                >
                                                    Rechazar
                                                </button>
                                            </div>
                                            <button 
                                                className={`btn btn-sm ${rep.estado === 'Inactivo' ? 'btn-success' : 'btn-danger'}`}
                                                style={{ fontSize: '0.75rem', padding: '6px', width: '100%', marginTop: '4px' }}
                                                onClick={() => handleToggleEstado(rep.id, rep.estado || 'Inactivo')}
                                            >
                                                {rep.estado === 'Inactivo' ? 'Marcar Activo' : 'Forzar Inactivo'}
                                            </button>
                                        </div>
                                    </td>
                                    <td>
                                        <button 
                                            className="btn btn-sm"
                                            style={{ 
                                                background: (rep.locales_prioridad?.length > 0) ? '#6366f1' : '#f1f5f9',
                                                color: (rep.locales_prioridad?.length > 0) ? 'white' : '#64748b',
                                                fontSize: '0.75rem',
                                                padding: '6px 12px',
                                                border: '1px solid #e2e8f0'
                                            }}
                                            onClick={() => handleOpenPriorityModal(rep)}
                                        >
                                            🛡️ {rep.locales_prioridad?.length || 0} Locales
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            ) : activeTab === 'finanzas' ? (
                <div className="finanzas-container">
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                        <button 
                            className={`btn btn-sm ${finanzasSubTab === 'liquidacion' ? 'btn-primary' : 'btn-light'}`}
                            onClick={() => setFinanzasSubTab('liquidacion')}
                        >
                            📦 Liquidación de Pedidos
                        </button>
                        <button 
                            className={`btn btn-sm ${finanzasSubTab === 'calendario' ? 'btn-primary' : 'btn-light'}`}
                            onClick={() => setFinanzasSubTab('calendario')}
                        >
                            📅 Calendario de Pagos
                        </button>
                    </div>

                    {finanzasSubTab === 'liquidacion' ? (
                        <div className="table-responsive">
                            <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>Liquidación de Envíos (Solo Entregados)</h3>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>Envíos finalizados pendientes de compensación</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <select 
                                        className="filter-select" 
                                        value={repFilter} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setRepFilter(val);
                                            if (val === 'Todos') {
                                                setSelectedSettleIds([]);
                                            } else {
                                                const selDriver = repartidores.find(r => r.id === val);
                                                if (selDriver && selDriver.es_partner) {
                                                    const linkedIds = repartidores
                                                        .filter(r => r.partner_id === selDriver.id || r.id === selDriver.id)
                                                        .map(r => r.id);
                                                    const partnerSettlements = settlements.filter(s => linkedIds.includes(s.repartidor_id));
                                                    setSelectedSettleIds(partnerSettlements.map(s => s.id));
                                                } else {
                                                    setSelectedSettleIds([]);
                                                }
                                            }
                                        }}
                                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                                    >
                                        <option value="Todos">Todos los repartidores</option>
                                        {repartidores.filter(r => r.admin_status === 'Aceptado' || r.es_partner).map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.nombre}{r.es_partner ? ' (Partner Logístico)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button className="btn btn-sm btn-primary" onClick={loadSettlements} disabled={settlementsLoading}>
                                        {settlementsLoading ? 'Cargando...' : 'Refrescar'}
                                    </button>
                                </div>
                            </header>

                            {selectedSettleIds.length > 0 && (
                                <div className="animate-fade-in" style={{ 
                                    background: '#eff6ff', 
                                    padding: '12px 20px', 
                                    borderRadius: '8px', 
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    border: '1px solid #bfdbfe'
                                }}>
                                    <div>
                                        <span style={{ fontWeight: 600, color: '#1e40af' }}>{selectedSettleIds.length} pedidos seleccionados</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button className="btn btn-sm" style={{ background: '#3b82f6', color: 'white' }} onClick={handleGenerateMessage}>
                                            Generar Comprobante
                                        </button>
                                        <button className="btn btn-sm" style={{ background: '#10b981', color: 'white' }} onClick={handleBulkMarkAsPaid}>
                                            Marcar como Saldados
                                        </button>
                                    </div>
                                </div>
                            )}

                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedSettleIds.length > 0 && selectedSettleIds.length === getFilteredSettlements().length}
                                                onChange={() => handleSelectAll(getFilteredSettlements())}
                                            />
                                        </th>
                                        <th>Fecha</th>
                                        <th>Pedido</th>
                                        <th>Repartidor</th>
                                        <th style={{ textAlign: 'right' }}>Monto Envío</th>
                                        <th>Estado Cobro</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getFilteredSettlements().map(settle => (
                                        <tr key={settle.id} className={selectedSettleIds.includes(settle.id) ? 'selected-row' : ''}>
                                            <td>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedSettleIds.includes(settle.id)}
                                                    onChange={() => toggleSelection(settle.id)}
                                                />
                                            </td>
                                            <td style={{ fontSize: '0.85rem' }}>{new Date(settle.created_at).toLocaleDateString()}</td>
                                            <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>#{settle.id.substring(0, 8)}</td>
                                            <td>{settle.repartidores?.nombre || settle.repartidor_id || 'N/A'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                                ${Number(settle.precio_envio || 0).toLocaleString('es-AR')}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className={`badge ${settle.cobro_repartidor_procesado ? 'success' : 'warning'}`}>
                                                        {settle.cobro_repartidor_procesado ? 'Saldado' : 'Pendiente'}
                                                    </span>
                                                    {allScheduledOrderIds.includes(settle.id) && !settle.cobro_repartidor_procesado && (
                                                        <span className="badge" style={{ background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            📅 Agendado
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <button 
                                                    className={`btn btn-sm ${settle.cobro_repartidor_procesado ? 'btn-secondary' : 'btn-primary'}`}
                                                    onClick={() => handleTogglePaymentStatus(settle.id, settle.cobro_repartidor_procesado)}
                                                >
                                                    {settle.cobro_repartidor_procesado ? 'Revertir' : 'Marcar Saldado'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot style={{ background: '#f8fafc', fontWeight: 800 }}>
                                    <tr>
                                        <td colSpan="4">TOTAL SELECCIONADO</td>
                                        <td style={{ textAlign: 'right', color: '#10b981' }}>
                                            ${getFilteredSettlements()
                                                .reduce((sum, s) => sum + Number(s.precio_envio || 0), 0)
                                                .toLocaleString('es-AR')}
                                        </td>
                                        <td colSpan="2" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            Pendiente: ${getFilteredSettlements()
                                                .filter(s => !s.cobro_repartidor_procesado)
                                                .reduce((sum, s) => sum + Number(s.precio_envio || 0), 0)
                                                .toLocaleString('es-AR')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="calendar-view animate-fade-in" style={{ color: '#0f172a' }}>
                            <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: '#000' }}>Calendario de Pagos a Repartidores</h3>
                                    <p style={{ fontSize: '0.85rem', color: '#334155' }}>Control manual de pagos efectuados o programados</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <button className="btn btn-light btn-sm" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}>◀</button>
                                    <span style={{ fontWeight: 700, minWidth: '120px', textAlign: 'center', color: '#000' }}>
                                        {calendarDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' }).toUpperCase()}
                                    </span>
                                    <button className="btn btn-light btn-sm" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}>▶</button>
                                </div>
                            </header>

                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(7, 1fr)', 
                                gap: '1px', 
                                background: '#e2e8f0', 
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                overflow: 'hidden'
                            }}>
                                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                                    <div key={d} style={{ background: '#f1f5f9', padding: '10px', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#000' }}>{d}</div>
                                ))}
                                {Array.from({ length: new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay() }).map((_, i) => (
                                    <div key={`empty-${i}`} style={{ background: 'white' }}></div>
                                ))}
                                {Array.from({ length: new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const paymentsOnDay = calendarPayments.filter(p => p.fecha === dateStr);
                                    
                                    return (
                                        <div 
                                            key={day} 
                                            onClick={() => {
                                                setSelectedDate(dateStr);
                                                setShowPaymentModal(true);
                                            }}
                                            style={{ 
                                                background: 'white', 
                                                minHeight: '100px', 
                                                padding: '8px',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s'
                                            }}
                                            className="calendar-day"
                                        >
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#000', marginBottom: '4px' }}>{day}</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {paymentsOnDay.map(p => (
                                                    <div 
                                                        key={p.id} 
                                                        style={{ 
                                                            fontSize: '0.7rem', 
                                                            background: '#f0fdf4', 
                                                            border: '1px solid #bbf7d0', 
                                                            padding: '2px 4px', 
                                                            borderRadius: '4px',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center'
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <span 
                                                            title={p.nota} 
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleJumpToSettlement(p);
                                                            }}
                                                        >
                                                            <b style={{ color: '#000' }}>{p.repartidores?.nombre?.split(' ')[0]}:</b> <span style={{ color: '#000' }}>${p.monto.toLocaleString()}</span>
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '2px' }}>
                                                            <button 
                                                                title="Copiar Resumen"
                                                                style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0 2px', fontSize: '0.8rem' }}
                                                                onClick={() => handleCopyCalendarSummary(p)}
                                                            >📋</button>
                                                            <button 
                                                                style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px' }}
                                                                onClick={() => handleDeletePayment(p.id)}
                                                            >✕</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            ) : activeTab === 'rubros' ? (
                <div className="rubros-config-container animate-fade-in">
                    <header style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0 }}>Niveles de Rapidez por Rubro</h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>Configura el nivel de rapidez y la ventana de stacking (pedidos simultáneos) por rubro.</p>
                    </header>
                    
                    {loadingRubros ? <div className="loading-state">Cargando rubros...</div> : (
                        <div className="table-responsive">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Rubro</th>
                                        <th>Nivel de Rapidez</th>
                                        <th>Ventana Stacking (Min)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rubrosConfig.map(r => (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 600 }}>{r.nombre}</td>
                                            <td>
                                                <select 
                                                    value={r.nivel_rapidez} 
                                                    onChange={(e) => handleUpdateRubro(r.id, 'nivel_rapidez', Number(e.target.value))}
                                                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                                                >
                                                    <option value={1}>Nivel 1 (Rápido)</option>
                                                    <option value={2}>Nivel 2 (Lento - Preparación)</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input 
                                                    type="number" 
                                                    value={r.ventana_stacking_minutos} 
                                                    onChange={(e) => handleUpdateRubro(r.id, 'ventana_stacking_minutos', Number(e.target.value))}
                                                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0', width: '80px' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <AdminPagos tipo="Repartidor" />
            )}
            {showInvoiceModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'white',
                        padding: '2rem',
                        borderRadius: '12px',
                        maxWidth: '500px',
                        width: '100%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        color: '#000'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#000' }}>
                            🧾 Comprobante de Pago
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: '#334155', marginBottom: '1rem' }}>
                            Copia el siguiente mensaje y envíalo al repartidor para confirmar la liquidación.
                        </p>
                        <pre style={{
                            background: '#f1f5f9',
                            padding: '1rem',
                            borderRadius: '8px',
                            whiteSpace: 'pre-wrap',
                            fontSize: '0.85rem',
                            fontFamily: 'inherit',
                            border: '1px solid #e2e8f0',
                            marginBottom: '1.5rem',
                            maxHeight: '300px',
                            overflowY: 'auto'
                        }}>
                            {generatedMessage}
                        </pre>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                className="btn btn-primary" 
                                style={{ flex: 1 }}
                                onClick={() => {
                                    navigator.clipboard.writeText(generatedMessage);
                                    toast.success('Mensaje copiado al portapapeles');
                                }}
                            >
                                Copiar Mensaje
                            </button>
                            <button 
                                className="btn btn-secondary" 
                                style={{ flex: 1 }}
                                onClick={() => setShowInvoiceModal(false)}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Prioridad */}
            {showPriorityModal && (
                <div className="modal-overlay" onClick={() => setShowPriorityModal(false)} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: '20px'
                }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                        background: 'white', padding: '2rem', borderRadius: '12px',
                        maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto'
                    }}>
                        <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>🛡️ Prioridad: {selectedRep?.nombre}</h3>
                            <button onClick={() => setShowPriorityModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </header>
                        
                        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>
                            Selecciona los locales donde este repartidor tendrá <b>20 segundos de prioridad</b> sobre los demás.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '2rem' }}>
                            {allLocales.map(local => (
                                <label key={local.id} style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px', 
                                    padding: '10px', 
                                    borderRadius: '8px', 
                                    background: tempPriorities.includes(local.id) ? '#f0f7ff' : '#f8fafc',
                                    border: '1px solid',
                                    borderColor: tempPriorities.includes(local.id) ? '#3b82f6' : '#e2e8f0',
                                    cursor: 'pointer'
                                }}>
                                    <input 
                                        type="checkbox" 
                                        checked={tempPriorities.includes(local.id)}
                                        onChange={() => handleTogglePriority(local.id)}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <img src={local.logo || 'https://placehold.co/40x40'} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{local.nombre}</span>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                className="btn btn-secondary" 
                                style={{ flex: 1 }}
                                onClick={() => setShowPriorityModal(false)}
                            >
                                Cancelar
                            </button>
                            <button 
                                className="btn btn-primary" 
                                style={{ flex: 1 }}
                                onClick={handleSavePriorities}
                                disabled={isSavingPriority}
                            >
                                {isSavingPriority ? 'Guardando...' : 'Guardar Prioridades'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Registro de Pago */}
            {showPaymentModal && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1100, padding: '20px'
                }}>
                    <div className="modal-content" style={{ background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '400px', width: '100%', color: '#000' }}>
                        <h3 style={{ marginTop: 0, color: '#000' }}>Registrar Pago: {selectedDate}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#000', fontWeight: 600 }}>Repartidor</label>
                                <select 
                                    className="filter-select" 
                                    style={{ width: '100%' }}
                                    value={newPayment.repartidor_id}
                                    onChange={(e) => setNewPayment({ ...newPayment, repartidor_id: e.target.value })}
                                >
                                    <option value="">Seleccionar...</option>
                                    {repartidores.filter(r => r.admin_status === 'Aceptado' || r.es_partner).map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.nombre}{r.es_partner ? ' (Partner Logístico)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#000', fontWeight: 600 }}>Monto ($)</label>
                                <input 
                                    type="number" 
                                    className="filter-select" 
                                    style={{ width: '100%', color: '#000' }}
                                    value={newPayment.monto}
                                    onChange={(e) => setNewPayment({ ...newPayment, monto: e.target.value })}
                                />
                            </div>
                            {pendingSettlementsForModal.length > 0 && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 700, color: '#000' }}>Seleccionar Pedidos Pendientes:</label>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px' }}>
                                        {pendingSettlementsForModal.map(s => (
                                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', color: '#000' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedOrderIdsInModal.includes(s.id)}
                                                    onChange={() => handleToggleOrderInModal(s.id)}
                                                />
                                                <span style={{ flex: 1, color: '#000' }}>#{s.id.substring(0,8)} ({new Date(s.created_at).toLocaleDateString()})</span>
                                                <span style={{ fontWeight: 700, color: '#000' }}>${Number(s.precio_envio).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#334155', marginTop: '4px' }}>
                                        Se seleccionaron {selectedOrderIdsInModal.length} pedidos.
                                    </p>
                                </div>
                            )}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#000', fontWeight: 600 }}>Nota / Concepto</label>
                                <textarea 
                                    className="filter-select" 
                                    style={{ width: '100%', minHeight: '80px', color: '#000' }}
                                    value={newPayment.nota}
                                    onChange={(e) => setNewPayment({ ...newPayment, nota: e.target.value })}
                                    placeholder="Ej: Liquidación semanal, bono, etc."
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPaymentModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreatePayment}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminRepartidores;
