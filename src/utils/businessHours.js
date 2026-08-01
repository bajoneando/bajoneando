/**
 * Utility to manage business hours logic.
 * Supports both legacy columns and the new flexible config_horarios (JSONB).
 */

const DAYS_MAP = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const normalize = (str) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

/**
 * Checks if the local is currently open based on its configuration.
 */
const getDayIntervals = (local, dayName) => {
  const dayNorm = normalize(dayName);

  // Parsear JSON config_horarios si viene como string
  let config = local.config_horarios;
  if (typeof config === 'string') {
    try { config = JSON.parse(config); } catch (e) {}
  }

  // 1. Configuración flexible (config_horarios)
  if (config && typeof config === 'object' && Object.keys(config).length > 0) {
    const dayConfigKey = Object.keys(config).find(k => normalize(k) === dayNorm);
    const dayConfig = dayConfigKey ? config[dayConfigKey] : null;

    if (dayConfig) {
      if (dayConfig.tipo === 'cerrado') return { tipo: 'cerrado', intervalos: [] };
      if (dayConfig.tipo === '24hs') return { tipo: '24hs', intervalos: [] };
      if (dayConfig.tipo === 'especifico' && Array.isArray(dayConfig.intervalos)) {
        return { tipo: 'especifico', intervalos: dayConfig.intervalos };
      }
    }
  }

  // 2. Fallback a columnas heredadas
  const { horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, dias_apertura } = local;

  if (dias_apertura && Array.isArray(dias_apertura) && dias_apertura.length > 0) {
    const normalizedDays = dias_apertura.map(normalize);
    if (!normalizedDays.includes(dayNorm)) return { tipo: 'cerrado', intervalos: [] };
  } else if (typeof dias_apertura === 'string' && dias_apertura.trim()) {
    const normalizedDays = dias_apertura.split(',').map(d => normalize(d.trim()));
    if (!normalizedDays.includes(dayNorm)) return { tipo: 'cerrado', intervalos: [] };
  }

  if (horario_apertura && horario_cierre) {
    const list = [{ inicio: horario_apertura, fin: horario_cierre }];
    if (horario_apertura2 && horario_cierre2) {
      list.push({ inicio: horario_apertura2, fin: horario_cierre2 });
    }
    return { tipo: 'especifico', intervalos: list };
  }

  return { tipo: 'desconocido', intervalos: [] };
};

/**
 * Checks if the local is currently open based on its configuration.
 * Handles overnight shifts across midnight without mixing closing time of previous day with opening time of current day.
 */
export const isLocalOpen = (local) => {
  if (!local) return false;

  const estadoNorm = (local.estado || '').toLowerCase().trim();

  // Si el local fue inhabilitado o suspendido administrativamente por el superadmin, NUNCA abre
  if (['inhabilitado', 'suspendido'].includes(estadoNorm)) {
    return false;
  }

  // 1. Check availability date (disponible_desde)
  if (local.disponible_desde) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = local.disponible_desde.split('-');
    const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
    if (today < availableDate) return false;
  }

  // 2. Si NO está en modo automático, depende 100% del estado manual ('abierto' o 'activo')
  if (!local.modo_automatico) {
    return estadoNorm === 'abierto' || estadoNorm === 'activo';
  }

  // 3. Si SÍ está en modo automático, el estado de apertura lo determina el horario semanal (Argentina UTC-3)
  const nowArgStr = new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' });
  const now = new Date(nowArgStr);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const dayIndex = now.getDay();
  const prevDayIndex = (dayIndex + 6) % 7;

  const currentDayName = DAYS_MAP[dayIndex];
  const prevDayName = DAYS_MAP[prevDayIndex];

  // A) Verificar turno de HOY
  const todayData = getDayIntervals(local, currentDayName);

  if (todayData.tipo === '24hs') return true;

  if (todayData.tipo === 'especifico') {
    const isOpenToday = todayData.intervalos.some(intervalo => {
      const [hI, mI] = (intervalo.inicio || '00:00').split(':').map(Number);
      const [hF, mF] = (intervalo.fin || '00:00').split(':').map(Number);
      const minInicio = hI * 60 + mI;
      const minFin = hF * 60 + mF;

      if (minInicio < minFin) {
        // Horario diurno el mismo día (ej: 12:00 a 16:00)
        return currentMinutes >= minInicio && currentMinutes <= minFin;
      } else if (minInicio > minFin) {
        // Horario nocturno que cruza la medianoche (ej: 20:00 a 00:30)
        // Para el día de hoy, el turno inició a las minInicio (20:00) y se extiende hasta las 23:59
        return currentMinutes >= minInicio;
      } else {
        // minInicio === minFin (ej: 00:00 a 00:00 -> abierto todo el día)
        return true;
      }
    });

    if (isOpenToday) return true;
  } else if (todayData.tipo === 'desconocido' && (estadoNorm === 'abierto' || estadoNorm === 'activo')) {
    return true;
  }

  // B) Verificar turno de AYER (extensión tras la medianoche hasta la madrugada de hoy)
  const yesterdayData = getDayIntervals(local, prevDayName);

  if (yesterdayData.tipo === '24hs') return true;

  if (yesterdayData.tipo === 'especifico') {
    const isOpenFromYesterday = yesterdayData.intervalos.some(intervalo => {
      const [hI, mI] = (intervalo.inicio || '00:00').split(':').map(Number);
      const [hF, mF] = (intervalo.fin || '00:00').split(':').map(Number);
      const minInicio = hI * 60 + mI;
      const minFin = hF * 60 + mF;

      if (minInicio > minFin) {
        // El turno de ayer inició ayer por la noche y cruza la medianoche (ej: 20:00 a 00:30)
        // En la madrugada de HOY, el local sigue abierto desde las 00:00 hasta minFin (00:30)
        return currentMinutes <= minFin;
      }
      return false;
    });

    if (isOpenFromYesterday) return true;
  }

  return false;
};

/**
 * Returns text like "abre a las 19:00" or "cierra a las 14:00"
 */
export const getNextStatusChange = (local) => {
  if (!local) return '';
  
  const isOpen = isLocalOpen(local);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentDayName = DAYS_MAP[now.getDay()];
  const currentDayNorm = normalize(currentDayName);

  // Simplified logic for "abre/cierra"
  // For better UX, we'll try to find the relevant time in the current day's config
  
  let intervals = [];

  // 1. Get intervals from config_horarios
  if (local.config_horarios && typeof local.config_horarios === 'object') {
    const dayConfigKey = Object.keys(local.config_horarios).find(k => normalize(k) === currentDayNorm);
    const dayConfig = dayConfigKey ? local.config_horarios[dayConfigKey] : null;
    if (dayConfig?.tipo === '24hs') return 'Abierto 24hs';
    if (dayConfig?.tipo === 'especifico' && Array.isArray(dayConfig.intervalos)) {
      intervals = dayConfig.intervalos;
    }
  }

  // 2. Fallback to legacy intervals
  if (intervals.length === 0 && local.horario_apertura && local.horario_cierre) {
    intervals.push({ inicio: local.horario_apertura, fin: local.horario_cierre });
    if (local.horario_apertura2 && local.horario_cierre2) {
      intervals.push({ inicio: local.horario_apertura2, fin: local.horario_cierre2 });
    }
  }

  if (isOpen) {
    // Find the interval we are currently in and return its end time
    const currentInterval = intervals.find(int => {
      const [hI, mI] = int.inicio.split(':').map(Number);
      const [hF, mF] = int.fin.split(':').map(Number);
      const minI = hI * 60 + mI;
      const minF = hF * 60 + mF;
      if (minI < minF) return currentMinutes >= minI && currentMinutes <= minF;
      return currentMinutes >= minI || currentMinutes <= minF;
    });
    if (currentInterval) return `cierra ${currentInterval.fin}`;
    return 'Abierto';
  } else {
    // Find the next interval that will open
    const nextInterval = intervals
      .map(int => {
        const [hI, mI] = int.inicio.split(':').map(Number);
        return { ...int, minI: hI * 60 + mI };
      })
      .filter(int => int.minI > currentMinutes)
      .sort((a, b) => a.minI - b.minI)[0];

    if (nextInterval) return `abre ${nextInterval.inicio}`;
    return 'Cerrado';
  }
};
