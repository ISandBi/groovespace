// Catálogo comercial: única fuente de verdad de precios. El frontend lo consulta en GET /api/pricing
// y el servidor lo vuelve a aplicar al reservar, así que ningún precio enviado por el navegador se acepta.

exports.rooms = [
  { id: 'sala_estudio_a', name: 'Sala Estudio A (Premium Master)', price: 350, capacity: 6, customizable: true, imagePath: '/sala-estudio-a.jpg', blurb: 'Cabina premium para grabar y mezclar con monitoreo de campo cercano.' },
  { id: 'sala_ensayo_b', name: 'Sala Ensayo B (Sincronizada)', price: 220, capacity: 4, imagePath: '/sala-estudio-b.jpg', blurb: 'Ensayo con backline sincronizado, ideal para bandas de cuatro.' },
  { id: 'sala_production_c', name: 'Sala Production C (Dolby Atmos)', price: 400, capacity: 3, imagePath: '/sala-estudio-c.jpg', blurb: 'Producción inmersiva con monitoreo Dolby Atmos.' },
  { id: 'sala_live_d', name: 'Sala Live Session D (Live Room)', price: 500, capacity: 8, imagePath: '/sala-estudio-d.jpg', blurb: 'Live room con captura multicámara para sesiones en vivo.' },
  { id: 'sala_orquesta_e', name: 'Sala E · Orquesta', price: 650, capacity: 100, customizable: true, imagePath: '/sala-estudio-e-orquesta.jpg', blurb: 'Foro para ensambles grandes y orquesta.' }
];

// Renta de equipo: precio por hora de sesión.
exports.rentalGear = [
  { id: 'git_1', name: 'Gibson Les Paul Standard', price: 80 },
  { id: 'bass_1', name: 'Fender Jazz Bass', price: 70 },
  { id: 'amp_1', name: 'Marshall JCM800 Combo', price: 100 },
  { id: 'drum_1', name: 'Platillos Zildjian K Custom', price: 120 }
];

// Servicios adicionales. unit: 'hour' (por hora de sesión) o 'flat' (cargo único por sesión).
exports.extras = [
  { id: 'rec_multitrack', name: 'Grabación multipista', unit: 'flat', price: 450, description: 'Captura cruda de todos los canales en la nube.' },
  { id: 'backline_tech', name: 'Técnico de backline', unit: 'hour', price: 120, description: 'Afinación y cambio de equipo durante la sesión.' },
  { id: 'live_stream', name: 'Transmisión en vivo', unit: 'flat', price: 800, description: 'Streaming multicámara de la sesión.' },
  { id: 'photo_video', name: 'Foto y video de la sesión', unit: 'flat', price: 700, description: 'Material para redes y prensa.' }
];

exports.limits = { minHours: 1, maxHours: 4, minLeadHours: 24, stepMinutes: 15, depositRate: 0.5 };
