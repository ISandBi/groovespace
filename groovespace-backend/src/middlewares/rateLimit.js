const windows = new Map();

module.exports = (windowMs, maxRequests) => (req, res, next) => {
  const now = Date.now();
  const key = `${req.ip}:${req.baseUrl}${req.path}`;
  let entry = windows.get(key);

  if (!entry || entry.expiresAt <= now) {
    if (windows.size > 1000) {
      for (const [address, window] of windows) {
        if (window.expiresAt <= now) windows.delete(address);
      }
    }
    entry = { count: 0, expiresAt: now + windowMs };
    windows.set(key, entry);
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    res.set('Retry-After', String(Math.ceil((entry.expiresAt - now) / 1000)));
    return res.status(429).json({ error: 'Demasiados intentos. Espera antes de volver a intentarlo.' });
  }
  return next();
};
