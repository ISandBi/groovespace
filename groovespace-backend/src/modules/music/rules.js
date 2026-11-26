// Reglas de acreditación de la app móvil (iguales a las que muestra la app).
module.exports = {
  creditPerPlay: 1,
  bonusPlays: 100, // las primeras reproducciones pagadas de una banda valen el doble
  minSeconds: 30,
  toleranceSeconds: 2, // latencia de red entre "inicio" y "completado"
  monthlyCapPerBand: 1500
};

/** Monto a abonar por una reproducción válida; 0 si la banda ya llegó al tope mensual. */
module.exports.payout = (paidBefore, monthlyTotal) => {
  const amount = module.exports.creditPerPlay * (paidBefore < module.exports.bonusPlays ? 2 : 1);
  return monthlyTotal + amount > module.exports.monthlyCapPerBand ? 0 : amount;
};
