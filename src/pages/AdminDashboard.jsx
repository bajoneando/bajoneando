import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import AdminLocales from './AdminLocales';
import AdminEmails from './AdminEmails';
import AdminTasks from './AdminTasks';
import AdminLogin from './AdminLogin';
import AdminRepartidores from './AdminRepartidores';
import AdminPagos from './AdminPagos';
import AdminPedidos from './AdminPedidos';
import AdminUsuarios from './AdminUsuarios';
import AdminBanners from './AdminBanners';
import AdminConfig from './AdminConfig';
import AdminPruebas from './AdminPruebas';
import AdminReportes from './AdminReportes';
import AdminPromos from './AdminPromos';
import AdminMundial from './AdminMundial';
import AdminCRM from './AdminCRM';
import AdminAds from './AdminAds';
import AdminMetricas from './AdminMetricas';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const { user, logoutUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('pedidos');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [stats, setStats] = useState({ locales: 0, pendingTasks: 0, users: 0 });

    useEffect(() => {
        if (!user || user.role !== 'admin') return;
        
        // Load some quick stats
        const loadStats = async () => {
            try {
                const locales = await api.adminGetLocales();
                const tasks = await api.getAdminTasks();
                const pendingTasks = tasks.filter(t => t.estado === 'Pendiente').length;
                const totalUsers = await api.adminGetUsuarios();
                setStats({
                    locales: locales.length,
                    pendingTasks: pendingTasks,
                    users: totalUsers.length
                });
            } catch (err) {
                console.error(err);
            }
        };
        loadStats();
    }, [user]);

    if (!user || user.role !== 'admin') {
        return <AdminLogin />;
    }

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        if (window.innerWidth <= 768) {
            setIsSidebarOpen(false);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'locales': return <AdminLocales />;
            case 'repartidores': return <AdminRepartidores />;
            case 'emails': return <AdminEmails />;
            case 'tasks': return <AdminTasks />;
            case 'pedidos': return <AdminPedidos />;
            case 'usuarios': return <AdminUsuarios />;
            case 'banners': return <AdminBanners />;
            case 'config': return <AdminConfig />;
            case 'pruebas': return <AdminPruebas />;
            case 'promos': return <AdminPromos />;
            case 'mundial': return <AdminMundial />;
            case 'reports': return <AdminReportes />;
            case 'crm': return <AdminCRM />;
            case 'ads': return <AdminAds />;
            case 'metricas': return <AdminMetricas />;
            default: return <AdminLocales />;
        }
    };

    return (
        <div className="admin-container">
            {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
            
            <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <button className="sidebar-close" onClick={toggleSidebar}>×</button>
                <div className="sidebar-header">
                    <img src="https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png" alt="Weep Admin" className="admin-logo" />
                    <h2>Admin Panel</h2>
                </div>
                <nav className="sidebar-nav">
                    <button className={activeTab === 'locales' ? 'active' : ''} onClick={() => handleTabClick('locales')}>
                        <span className="icon">🏪</span> Locales Registrados
                    </button>
                    <button className={activeTab === 'repartidores' ? 'active' : ''} onClick={() => handleTabClick('repartidores')}>
                        <span className="icon">🏍️</span> Repartidores
                    </button>
                    <button className={activeTab === 'emails' ? 'active' : ''} onClick={() => handleTabClick('emails')}>
                        <span className="icon">📧</span> Panel Email
                    </button>
                    <button className={activeTab === 'tasks' ? 'active' : ''} onClick={() => handleTabClick('tasks')}>
                        <span className="icon">📋</span> Tareas Pendientes
                    </button>
                    <button className={activeTab === 'pedidos' ? 'active' : ''} onClick={() => handleTabClick('pedidos')}>
                        <span className="icon">📦</span> Pedidos
                    </button>
                    <button className={activeTab === 'usuarios' ? 'active' : ''} onClick={() => handleTabClick('usuarios')}>
                        <span className="icon">👥</span> Usuarios
                    </button>
                    <button className={activeTab === 'banners' ? 'active' : ''} onClick={() => handleTabClick('banners')}>
                        <span className="icon">🖼️</span> Banners
                    </button>
                    <button className={activeTab === 'config' ? 'active' : ''} onClick={() => handleTabClick('config')}>
                        <span className="icon">⚙️</span> Configuración
                    </button>
                    <button className={activeTab === 'promos' ? 'active' : ''} onClick={() => handleTabClick('promos')}>
                        <span className="icon">🚀</span> Promos y Descuentos
                    </button>
                    <button className={activeTab === 'mundial' ? 'active' : ''} onClick={() => handleTabClick('mundial')}>
                        <span className="icon">🏆</span> Mundial 2026
                    </button>
                    <button className={activeTab === 'crm' ? 'active' : ''} onClick={() => handleTabClick('crm')}>
                        <span className="icon">🤝</span> CRM / Clientes
                    </button>
                    <button className={activeTab === 'ads' ? 'active' : ''} onClick={() => handleTabClick('ads')}>
                        <span className="icon">📢</span> Wepi Ads
                    </button>
                    <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => handleTabClick('reports')}>
                        <span className="icon">📊</span> Informes de Gestión
                    </button>
                    <button className={activeTab === 'metricas' ? 'active' : ''} onClick={() => handleTabClick('metricas')}>
                        <span className="icon">📈</span> Métricas de Uso
                    </button>
                    <button className={activeTab === 'pruebas' ? 'active' : ''} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => handleTabClick('pruebas')}>
                        <span className="icon">🧪</span> Pruebas
                    </button>

                </nav>
                <div className="sidebar-footer">
                    <div className="admin-user-info">
                        <p>{user.name}</p>
                        <span>{user.email}</span>
                    </div>
                    <button className="logout-btn" onClick={logoutUser}>Cerrar Sesión</button>
                </div>
            </aside>

            <main className="admin-main">
                <header className="main-header">
                    <button className="menu-toggle" onClick={toggleSidebar}>
                        ☰
                    </button>
                    <div className="header-stats">
                        <div className="stat-card">
                            <h3>{stats.locales}</h3>
                            <p>Locales</p>
                        </div>
                        <div className="stat-card">
                            <h3>{stats.pendingTasks}</h3>
                            <p>Tareas</p>
                        </div>
                        <div className="stat-card">
                            <h3>{stats.users}</h3>
                            <p>Usuarios</p>
                        </div>
                        <div className="stat-card">
                            <h3>ACT</h3>
                            <p>Plataforma</p>
                        </div>
                    </div>
                </header>

                <section className="content-area animate-fade-in">
                    {renderContent()}
                </section>
            </main>
        </div>
    );
};

export default AdminDashboard;
