export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export const installQaRequestTagging = () => {
  if (typeof window === 'undefined' || window.__groovespaceQaFetchInstalled) return;
  const originalFetch = window.fetch.bind(window);
  const apiOrigin = new URL(API_ORIGIN, window.location.href).origin;

  window.fetch = (input, init) => {
    let token;
    let sessionId;
    let requestUrl;
    try {
      token = window.sessionStorage.getItem('groovespace.qaToken');
      if (!token) return originalFetch(input, init);
      requestUrl = new URL(input instanceof Request ? input.url : input, window.location.href);
      if (requestUrl.origin !== apiOrigin || !requestUrl.pathname.startsWith('/api/')) {
        return originalFetch(input, init);
      }
      sessionId = window.sessionStorage.getItem('groovespace.qaSessionId');
      if (!sessionId) {
        sessionId = typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.sessionStorage.setItem('groovespace.qaSessionId', sessionId);
      }
    } catch (error) {
      console.warn('[GrooveSpace QA] No se pudieron etiquetar las solicitudes de prueba.', error);
      return originalFetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.set('X-QA-Token', token);
    headers.set('X-QA-Session-Id', sessionId);
    return originalFetch(input, { ...init, headers });
  };
  window.__groovespaceQaFetchInstalled = true;
};

export const readApiResponse = async (response, fallbackMessage) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    throw new Error(
      `La API devolvió una respuesta que no es JSON para ${response.url}. ` +
      `Verifica que VITE_API_URL apunte al backend (por ejemplo, http://localhost:5000/api), ` +
      'que el backend esté activo, actualizado y reiniciado después de agregar rutas.'
    );
  }

  try {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || fallbackMessage);
    return data;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('La API devolvió JSON con formato inválido.');
    throw error;
  }
};