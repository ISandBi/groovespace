import { API_URL, API_ORIGIN, readApiResponse } from '../api';

/** Llamada JSON a la API con token opcional. Lanza Error con el mensaje del servidor. */
export const api = async (path, { method = 'GET', token, body, form, signal } = {}) => {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const response = await fetch(`${API_URL}${path}`, { method, headers, body: payload, signal });
  return readApiResponse(response, 'No se pudo completar la solicitud.');
};

/** Imagen de banda/instrumento: acepta rutas /uploads, rutas de API (logo provisional) o URLs absolutas. */
export const assetUrl = (path) => {
  if (!path) return '';
  if (/^https?:/i.test(path)) return path;
  return `${API_ORIGIN}${path}`;
};

/** URL protegida de streaming con token de corta duración (para <audio>/<video>, que no envían cabeceras). */
/** El servidor devuelve rutas /api/... con el token de reproducción ya incluido. */
export const absoluteApi = (path) => `${API_ORIGIN}${path}`;

export const mxn = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(value) || 0);
export const formatDate = (iso) => { try { return new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; } };
export const formatDateTime = (value) => { try { return new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; } };
export const formatBytes = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`);
export const formatClock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export { API_URL };
