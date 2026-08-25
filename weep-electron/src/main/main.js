const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
let mainWindow;
let printerWindow;
let printQueue = [];
let isPrinting = false;
let lastProcessedOrderId = null;

// Lógica de Auto-configuración por nombre de archivo (soporta Weep_ y Wepi_)
const fileName = path.basename(process.execPath);
const match = fileName.match(/(?:Weep|Wepi)_(LOC-[\w-]+)/i);
if (match && match[1] && !store.get('localId')) {
    store.set('localId', match[1]);
}

function createWindows() {
    // Ventana Principal
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, '../../assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    // mainWindow.webContents.openDevTools(); // Descomentar para debug

    // Ventana de Impresión (Oculta)
    printerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    printerWindow.loadFile(path.join(__dirname, '../print/ticket.html'));

    mainWindow.on('closed', () => {
        app.quit();
    });
}

// Gestión de la Cola de Impresión
async function processQueue() {
    if (isPrinting || printQueue.length === 0) return;

    isPrinting = true;
    const task = printQueue.shift();
    let timeoutId = null;

    const handleTicketReady = async () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        
        const printerName = store.get('printerName', '');
        printerWindow.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: printerName
        }, (success, errorType) => {
            if (!success) console.error('Error de impresión:', errorType);
            
            isPrinting = false;
            processQueue();
        });
    };

    // 1. Registrar el listener para la respuesta ANTES de enviar el pedido
    ipcMain.once('ticket-ready', handleTicketReady);

    // 2. Añadir un setTimeout de seguridad (4 segundos) para evitar el congelamiento de la cola
    timeoutId = setTimeout(() => {
        console.warn('Timeout de seguridad alcanzado esperando "ticket-ready" para el pedido:', task.id);
        // Remover el listener registrado para evitar ejecuciones huérfanas
        ipcMain.off('ticket-ready', handleTicketReady);
        isPrinting = false;
        processQueue();
    }, 4000);

    try {
        // 3. Enviar el pedido y el tipo de copia a la ventana
        printerWindow.webContents.send('render-ticket', task, task.copyType);
    } catch (err) {
        console.error('Error procesando cola:', err);
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        ipcMain.off('ticket-ready', handleTicketReady);
        isPrinting = false;
        processQueue();
    }
}

// Eventos IPC
ipcMain.handle('get-printers', async () => {
    return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('get-settings', () => {
    return {
        wsUrl: store.get('wsUrl', 'Supabase Realtime'),
        localId: store.get('localId', ''),
        autoPrint: store.get('autoPrint', true),
        printerName: store.get('printerName', '')
    };
});

ipcMain.on('save-settings', (event, settings) => {
    store.set('wsUrl', settings.wsUrl);
    store.set('localId', settings.localId);
    store.set('autoPrint', settings.autoPrint);
    store.set('printerName', settings.printerName);
});

ipcMain.on('new-order', (event, order) => {
    // Evitar duplicados usando db_id que es el UUID real de la DB para que no haya colisiones
    const uniqueId = order.db_id || order.id;
    if (uniqueId === lastProcessedOrderId) return;
    lastProcessedOrderId = uniqueId;

    console.log('Nuevo pedido recibido:', order.id);
    
    // Notificar a la UI
    mainWindow.webContents.send('update-last-order', order);

    // Agregar a cola si la auto-impresión está activa
    if (store.get('autoPrint', true)) {
        printQueue.push({ ...order, copyType: 'control' });
        printQueue.push({ ...order, copyType: 'client' });
        processQueue();
    }
});

// Auto-arranque (Solo Windows)
if (process.platform === 'win32') {
    app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe')
    });
}

app.whenReady().then(createWindows);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
