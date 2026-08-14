import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminMetricas = () => {
    const [rawMetrics, setRawMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCity, setSelectedCity] = useState('all');
    const [dateRange, setDateRange] = useState('7d'); // '7d', '30d', 'all'
    const [sortField, setSortField] = useState('visitas_totales');
    const [sortAsc, setSortAsc] = useState(false);

    const [emailMetrics, setEmailMetrics] = useState([]);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const data = await api.adminGetUsoMetricas();
                setRawMetrics(data || []);
                const eMetrics = await api.adminGetEmailClickMetrics();
                setEmailMetrics(eMetrics || []);
            } catch (err) {
                console.error(err);
                toast.error('Error al cargar las métricas de uso.');
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, []);

    // Agrupar métricas de clics de email por campaña
    const emailCampaignSummary = useMemo(() => {
        const map = {};
        emailMetrics.forEach(item => {
            const camp = item.campaign || 'Campaña General';
            if (!map[camp]) {
                map[camp] = {
                    campaign: camp,
                    ciudad: item.ciudad || 'Todas',
                    clicks: 0,
                    lastClick: item.created_at
                };
            }
            map[camp].clicks += 1;
            if (new Date(item.created_at) > new Date(map[camp].lastClick)) {
                map[camp].lastClick = item.created_at;
            }
        });
        return Object.values(map).sort((a, b) => b.clicks - a.clicks);
    }, [emailMetrics]);

    // 1. Obtener lista de ciudades única para los filtros
    const citiesList = useMemo(() => {
        const cities = new Set();
        rawMetrics.forEach(m => {
            if (m.locales?.ciudad) {
                cities.add(m.locales.ciudad);
            }
        });
        return Array.from(cities).sort();
    }, [rawMetrics]);

    // 2. Filtrar métricas por fecha y ciudad
    const filteredMetrics = useMemo(() => {
        let result = [...rawMetrics];

        // Filtro de ciudad
        if (selectedCity !== 'all') {
            result = result.filter(m => m.locales?.ciudad === selectedCity);
        }

        // Filtro de rango de fechas
        if (dateRange !== 'all') {
            const today = new Date();
            let limitDate = new Date();
            if (dateRange === '7d') {
                limitDate.setDate(today.getDate() - 7);
            } else if (dateRange === '30d') {
                limitDate.setDate(today.getDate() - 30);
            }
            
            result = result.filter(m => {
                if (!m.fecha) return false;
                const mDate = new Date(m.fecha);
                return mDate >= limitDate;
            });
        }

        return result;
    }, [rawMetrics, selectedCity, dateRange]);

    // 3. Agrupar métricas por local
    const metricsByLocal = useMemo(() => {
        const groups = {};

        filteredMetrics.forEach(m => {
            const localId = m.local_id;
            if (!localId) return;

            if (!groups[localId]) {
                groups[localId] = {
                    id: localId,
                    nombre: m.locales?.nombre || 'Local Desconocido',
                    ciudad: m.locales?.ciudad || 'Desconocida',
                    slug: m.locales?.slug || '',
                    visitas_totales: 0,
                    visitas_wepi: 0,
                    visitas_enlace_propio: 0,
                    visitas_whatsapp: 0,
                    carritos_creados: 0,
                    pedidos_creados: 0,
                    pedidos_entregados_totales: 0,
                    pedidos_entregados_wepi: 0,
                    pedidos_entregados_enlace_propio: 0
                };
            }

            groups[localId].visitas_totales += (m.visitas_totales || 0);
            groups[localId].visitas_wepi += (m.visitas_wepi || 0);
            groups[localId].visitas_enlace_propio += (m.visitas_enlace_propio || 0);
            groups[localId].visitas_whatsapp += (m.visitas_whatsapp || 0);
            groups[localId].carritos_creados += (m.carritos_creados || 0);
            groups[localId].pedidos_creados += (m.pedidos_creados || 0);
            groups[localId].pedidos_entregados_totales += (m.pedidos_entregados_totales || 0);
            groups[localId].pedidos_entregados_wepi += (m.pedidos_entregados_wepi || 0);
            groups[localId].pedidos_entregados_enlace_propio += (m.pedidos_entregados_enlace_propio || 0);
        });

        // Convertir a array y ordenar
        const list = Object.values(groups).map(g => {
            const abandonados = Math.max(0, g.carritos_creados - g.pedidos_creados);
            const conversion = g.carritos_creados > 0 
                ? Number(((g.pedidos_creados / g.carritos_creados) * 100).toFixed(1)) 
                : 0;

            return {
                ...g,
                carritos_abandonados: abandonados,
                conversion
            };
        });

        return list.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [filteredMetrics, sortField, sortAsc]);

    // 4. Calcular métricas agregadas globales
    const globals = useMemo(() => {
        const totals = {
            visitas_totales: 0,
            visitas_wepi: 0,
            visitas_enlace_propio: 0,
            visitas_whatsapp: 0,
            carritos_creados: 0,
            pedidos_creados: 0,
            pedidos_entregados_totales: 0,
            pedidos_entregados_wepi: 0,
            pedidos_entregados_enlace_propio: 0,
            carritos_abandonados: 0
        };

        metricsByLocal.forEach(l => {
            totals.visitas_totales += l.visitas_totales;
            totals.visitas_wepi += l.visitas_wepi;
            totals.visitas_enlace_propio += l.visitas_enlace_propio;
            totals.visitas_whatsapp += l.visitas_whatsapp;
            totals.carritos_creados += l.carritos_creados;
            totals.pedidos_creados += l.pedidos_creados;
            totals.pedidos_entregados_totales += l.pedidos_entregados_totales;
            totals.pedidos_entregados_wepi += l.pedidos_entregados_wepi;
            totals.pedidos_entregados_enlace_propio += l.pedidos_entregados_enlace_propio;
            totals.carritos_abandonados += l.carritos_abandonados;
        });

        const conversion = totals.carritos_creados > 0
            ? ((totals.pedidos_creados / totals.carritos_creados) * 100).toFixed(1)
            : '0.0';

        return { ...totals, conversion };
    }, [metricsByLocal]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <p style={{ color: 'var(--gray-500)', fontWeight: 600 }}>Cargando métricas de la plataforma...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gray-900)', margin: 0 }}>📈 Métricas Generales de Uso</h2>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                        Monitorea las visitas, carritos e interacciones de WhatsApp en la plataforma multiciudad.
                    </p>
                </div>

                {/* Filtros de Control */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-600)' }}>Ciudad</label>
                        <select 
                            value={selectedCity} 
                            onChange={(e) => setSelectedCity(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '0.85rem', fontWeight: 600, outline: 'none', background: 'white' }}
                        >
                            <option value="all">Todas las ciudades</option>
                            {citiesList.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-600)' }}>Período</label>
                        <select 
                            value={dateRange} 
                            onChange={(e) => setDateRange(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '0.85rem', fontWeight: 600, outline: 'none', background: 'white' }}
                        >
                            <option value="7d">Últimos 7 días</option>
                            <option value="30d">Últimos 30 días</option>
                            <option value="all">Histórico completo</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Fila de Tarjetas de Indicadores */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '16px' 
            }}>
                <div className="card" style={{ padding: '20px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.6rem' }}>👁️</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-400)', letterSpacing: '0.5px' }}>Visitas Totales</span>
                    </div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--gray-800)' }}>{globals.visitas_totales}</h3>
                </div>

                <div className="card" style={{ padding: '20px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.6rem' }}>🤖</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#0284c7', letterSpacing: '0.5px' }}>Tráfico Bot WA</span>
                    </div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#0369a1' }}>{globals.visitas_whatsapp}</h3>
                </div>

                <div className="card" style={{ padding: '20px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.6rem' }}>🔗</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#0d9488', letterSpacing: '0.5px' }}>Enlaces Propios</span>
                    </div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#0f766e' }}>{globals.visitas_enlace_propio}</h3>
                </div>

                <div className="card" style={{ padding: '20px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.6rem' }}>🛒</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-400)', letterSpacing: '0.5px' }}>Carritos Creados</span>
                    </div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--gray-800)' }}>{globals.carritos_creados}</h3>
                </div>

                <div className="card" style={{ padding: '20px', background: '#fffbfa', border: '1px solid #fee2e2', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.6rem' }}>⏳</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#ef4444', letterSpacing: '0.5px' }}>Abandonos</span>
                    </div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#dc2626' }}>{globals.carritos_abandonados}</h3>
                </div>

                <div className="card" style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.6rem' }}>📈</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#16a34a', letterSpacing: '0.5px' }}>Conversión</span>
                    </div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#15803d' }}>{globals.conversion}%</h3>
                </div>
            </div>

            {/* ─── Sección de Métricas de Conversión y Clics desde Email Marketing ─── */}
            <div className="card" style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📧 Conversiones & Clics desde Email Marketing
                    </h3>
                    <span style={{ fontSize: '0.8rem', background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '14px', fontWeight: '700' }}>
                        Total Clics: {emailMetrics.length}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Clics Registrados</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{emailMetrics.length}</div>
                    </div>
                    <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Campañas con Clics</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#e63946', marginTop: '4px' }}>{emailCampaignSummary.length}</div>
                    </div>
                </div>

                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Rendimiento por Campaña de Email</h4>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--gray-200)', textAlign: 'left', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                                <th style={{ padding: '10px 8px' }}>Campaña</th>
                                <th style={{ padding: '10px 8px' }}>Ciudad Target</th>
                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Total Clics</th>
                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Último Clic</th>
                                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Enlace de Prueba</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '0.86rem', color: 'var(--gray-700)' }}>
                            {emailCampaignSummary.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                                        Aún no hay clics de email registrados. Los clics se contarán automáticamente cuando los usuarios ingresen desde los botones de los correos.
                                    </td>
                                </tr>
                            ) : (
                                emailCampaignSummary.map((c, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--gray-150)' }}>
                                        <td style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a' }}>{c.campaign}</td>
                                        <td style={{ padding: '10px 8px', color: '#475569' }}>{c.ciudad}</td>
                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#e63946' }}>{c.clicks}</td>
                                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b', fontSize: '0.78rem' }}>
                                            {new Date(c.lastClick).toLocaleString('es-AR')}
                                        </td>
                                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => {
                                                    const url = `${window.location.origin}/pedir?ref=email&campaign=${encodeURIComponent(c.campaign)}`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success('Enlace de prueba copiado!');
                                                }}
                                                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
                                            >
                                                📋 Copiar Enlace
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tabla Detallada por Local */}
            <div className="card" style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '20px', overflowX: 'auto' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--gray-800)' }}>Rendimiento Detallado de Comercios</h3>
                
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--gray-200)', textAlign: 'left', fontSize: '0.85rem', color: 'var(--gray-500)', userSelect: 'none' }}>
                            <th style={{ padding: '12px 8px', cursor: 'pointer' }} onClick={() => handleSort('nombre')}>Local {sortField === 'nombre' && (sortAsc ? '▲' : '▼')}</th>
                            <th style={{ padding: '12px 8px', cursor: 'pointer' }} onClick={() => handleSort('ciudad')}>Ciudad {sortField === 'ciudad' && (sortAsc ? '▲' : '▼')}</th>
                            <th style={{ padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('visitas_totales')}>Visitas Tot. {sortField === 'visitas_totales' && (sortAsc ? '▲' : '▼')}</th>
                            <th style={{ padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('visitas_wepi')}>Visitas Wepi {sortField === 'visitas_wepi' && (sortAsc ? '▲' : '▼')}</th>
                            <th style={{ padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('visitas_enlace_propio')}>Visitas Enlace {sortField === 'visitas_enlace_propio' && (sortAsc ? '▲' : '▼')}</th>
                            <th style={{ padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('carritos_abandonados')}>Abandonos {sortField === 'carritos_abandonados' && (sortAsc ? '▲' : '▼')}</th>
                            <th style={{ padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('pedidos_entregados_totales')}>Compras Tot. {sortField === 'pedidos_entregados_totales' && (sortAsc ? '▲' : '▼')}</th>
                            <th style={{ padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('pedidos_entregados_wepi')}>Compras Wepi {sortField === 'pedidos_entregados_wepi' && (sortAsc ? '▲' : '▼')}</th>
                            <th style={{ padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('pedidos_entregados_enlace_propio')}>Compras Enlace {sortField === 'pedidos_entregados_enlace_propio' && (sortAsc ? '▲' : '▼')}</th>
                            <th style={{ padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('conversion')}>Conv. % {sortField === 'conversion' && (sortAsc ? '▲' : '▼')}</th>
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: '0.9rem', color: 'var(--gray-700)' }}>
                        {metricsByLocal.length === 0 ? (
                            <tr>
                                <td colSpan="10" style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-400)' }}>No hay datos disponibles para el período o ciudad seleccionados.</td>
                            </tr>
                        ) : (
                            metricsByLocal.map(l => (
                                <tr key={l.id} style={{ borderBottom: '1px solid var(--gray-150)', transition: 'background 0.15s' }}>
                                    <td style={{ padding: '12px 8px', fontWeight: 700 }}>{l.nombre}</td>
                                    <td style={{ padding: '12px 8px', color: 'var(--gray-500)' }}>{l.ciudad}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600 }}>{l.visitas_totales}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0369a1', fontWeight: 600 }}>{l.visitas_wepi}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0f766e', fontWeight: 600 }}>{l.visitas_enlace_propio}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{l.carritos_abandonados}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{l.pedidos_entregados_totales}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0369a1', fontWeight: 600 }}>{l.pedidos_entregados_wepi}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0f766e', fontWeight: 600 }}>{l.pedidos_entregados_enlace_propio}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                        <span style={{ 
                                            padding: '4px 8px', 
                                            borderRadius: '6px', 
                                            background: l.conversion >= 30 ? '#d1fae5' : l.conversion >= 15 ? '#fef3c7' : '#f3f4f6',
                                            color: l.conversion >= 30 ? '#065f46' : l.conversion >= 15 ? '#92400e' : '#374151',
                                            fontWeight: 700,
                                            fontSize: '0.8rem'
                                        }}>
                                            {l.conversion}%
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminMetricas;
