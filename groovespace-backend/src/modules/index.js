// Punto único donde se montan los módulos de dominio. Cada módulo expone sus rutas en `routes.js`
// y su lógica de negocio en `service.js`; los controladores sólo traducen HTTP.
module.exports = (app) => {
  app.use('/api', require('./quotes/routes'));
  const bands = require('./bands/routes');
  app.use('/api/branding', require('./branding/routes'));
  app.use('/api/band', bands.mine);
  app.use('/api/band-files', bands.files);
  app.use('/api/stage-pack', bands.stage);
  app.use('/api/epk', bands.epk);
  require('./splits/service'); // registra el manejador de pagos divididos
  require('./wallet/service'); // registra la recarga de cartera
  app.use('/api/splits', require('./splits/routes'));
  app.use('/api/wallet', require('./wallet/routes'));
  app.use('/api/chat', require('./chat/routes'));
  require('./events/service'); // registra el cobro de boletos
  app.use('/api/events', require('./events/routes'));
  app.use('/api/marketplace', require('./marketplace/routes'));
  app.use('/api/deliverables', require('./deliverables/routes'));
  app.use('/api/contracts', require('./contracts/routes'));
  app.use('/api/demos', require('./demos/routes'));
  app.use('/api/notifications', require('./notifications/routes'));
};
