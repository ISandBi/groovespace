const crypto = require('crypto');
const Contract = require('./Contract');
const Band = require('../../models/Band');
const { getProvider } = require('./provider');
const { engineers } = require('../../config/engineers');
const { notify } = require('../notifications/service');
const { assert, cleanString, isObjectId } = require('../../lib/http');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

exports.RENTAL_TERMS = {
  version: 'renta-2026-11-v1',
  title: 'Términos de renta de salas GrooveSpace',
  body: [
    '1. Reserva. La sala queda apartada por 12 horas; si no se paga el anticipo del 50% (o el total) en ese plazo, la reserva se cancela y la sala se libera.',
    '2. Saldo. El saldo debe liquidarse al menos 24 horas antes de la sesión.',
    '3. Acceso. La banda presenta su boleto con QR en recepción; el acceso abre 1 hora antes de la sesión.',
    '4. Cuidado del equipo. La banda responde por daños al backline y a la sala durante su sesión.',
    '5. Cancelaciones. Se aplican las políticas vigentes publicadas en el sitio.',
    '6. Datos personales y de pago. Se tratan conforme al aviso de protección de datos (PCI DSS y NIST).'
  ].join('\n')
};

const partyFor = async (bandId, key) => {
  const band = await Band.findById(bandId).select('leaderName members');
  if (key === 'leader') return { key, name: band.leaderName, role: 'Líder' };
  if (key.startsWith('m:')) { const member = band.members.id(key.slice(2)); return member && { key, name: member.name, role: member.role === 'tesorero' ? 'Tesorero' : 'Integrante' }; }
  if (key.startsWith('e:')) { const engineer = engineers.find((item) => item.id === key.slice(2)); return engineer && { key, name: engineer.name, role: 'Ingeniero' }; }
  return null;
};

const actorKey = (actor) => (actor.type === 'band' ? 'leader' : actor.type === 'member' ? `m:${actor.id}` : actor.type === 'engineer' ? `e:${actor.id}` : null);

const view = (contract) => contract.toObject();

/** Contrato de coproducción: las partes y el reparto (suma 100%) quedan fijados antes de firmar. */
exports.createCoProduction = async ({ actor, title, body, splits }) => {
  assert(['lider', 'tesorero'].includes(actor.role), 403, 'Sólo el líder o el tesorero crean contratos.');
  const name = cleanString(title, 140);
  const text = cleanString(body, 8000);
  assert(name && text.length >= 40, 400, 'Escribe el título y las cláusulas del contrato (mínimo 40 caracteres).');
  assert(Array.isArray(splits) && splits.length >= 2 && splits.length <= 20, 400, 'Define el reparto entre 2 y 20 partes.');
  const parties = [];
  const rows = [];
  for (const split of splits) {
    const key = String(split?.key || '');
    const percent = Number(split?.percent);
    assert(Number.isFinite(percent) && percent > 0 && percent <= 100, 400, 'Cada porcentaje debe estar entre 0 y 100.');
    assert(!parties.some((party) => party.key === key), 400, 'Una parte aparece más de una vez.');
    const party = await partyFor(actor.bandId, key);
    assert(party, 400, 'Una de las partes no existe.');
    parties.push(party);
    rows.push({ key, label: party.name, percent });
  }
  assert(Math.abs(rows.reduce((sum, row) => sum + row.percent, 0) - 100) < 0.001, 400, 'El reparto debe sumar exactamente 100%.');
  const bodyHash = sha256(JSON.stringify({ name, text, rows }));
  const provider = getProvider();
  const envelope = await provider.createEnvelope({ title: name, bodyHash });
  const contract = await Contract.create({
    bandId: actor.bandId, kind: 'co_production', title: name, body: text, bodyHash, parties, splits: rows,
    provider: { name: provider.name, externalEnvelopeId: envelope.externalEnvelopeId, nom151: { status: 'not_connected' } }, createdBy: `${actor.type}:${actor.id}`
  });
  await Promise.all(parties.filter((party) => party.key !== actorKey(actor)).map((party) => notify({
    recipientType: party.key.startsWith('m:') ? 'member' : party.key.startsWith('e:') ? 'engineer' : 'band',
    recipientId: party.key.startsWith('m:') ? party.key.slice(2) : party.key.startsWith('e:') ? party.key.slice(2) : actor.bandId,
    kind: 'contract_to_sign', title: `Contrato por firmar: ${name}`, body: 'Revisa el reparto y firma electrónicamente.', link: party.key.startsWith('e:') ? '/ingenieria' : '/banda', dedupeKey: `contract:${contract.id}:${party.key}`
  })));
  return view(contract);
};

exports.sign = async ({ actor, id, typedName }) => {
  assert(isObjectId(id), 400, 'Identificador no válido.');
  const contract = await Contract.findById(id);
  assert(contract && contract.status === 'pending_signatures', 404, 'El contrato no existe o ya no admite firmas.');
  const key = actorKey(actor);
  const party = contract.parties.find((item) => item.key === key);
  assert(party && (!actor.bandId || String(contract.bandId) === actor.bandId), 403, 'No eres parte de este contrato.');
  assert(!contract.signatures.some((item) => item.key === key), 409, 'Ya firmaste este contrato.');
  assert(cleanString(typedName, 100).toLowerCase() === party.name.toLowerCase(), 400, 'Escribe tu nombre completo tal como aparece en el contrato para firmar.');
  const signedAt = new Date();
  contract.signatures.push({ key, name: party.name, typedName: cleanString(typedName, 100), signedAt, sealHash: sha256(`${contract.id}|${contract.bodyHash}|${key}|${signedAt.toISOString()}`) });
  if (contract.signatures.length === contract.parties.length) {
    contract.status = 'fully_signed';
    const outcome = await getProvider().onFullySigned(contract.toObject());
    if (outcome?.nom151) contract.provider.nom151 = outcome.nom151;
  }
  await contract.save();
  return view(contract);
};

exports.list = async (actor) => {
  if (actor.type === 'engineer') return (await Contract.find({ 'parties.key': `e:${actor.id}` }).sort({ createdAt: -1 })).map(view);
  return (await Contract.find({ bandId: actor.bandId }).sort({ createdAt: -1 })).map(view);
};

// ---------- Términos de renta: aceptación con constancia ----------
exports.termsStatus = async (actor) => {
  const accepted = await Contract.findOne({ bandId: actor.bandId, kind: 'rental_terms', bodyHash: sha256(exports.RENTAL_TERMS.version + exports.RENTAL_TERMS.body) });
  return { ...exports.RENTAL_TERMS, accepted: Boolean(accepted), acceptedAt: accepted?.signatures[0]?.signedAt || null };
};

exports.acceptTerms = async ({ actor, typedName }) => {
  assert(actor.role === 'lider', 403, 'Los términos los acepta el líder de la banda.');
  const status = await exports.termsStatus(actor);
  if (status.accepted) return status;
  const party = await partyFor(actor.bandId, 'leader');
  assert(cleanString(typedName, 100).toLowerCase() === party.name.toLowerCase(), 400, 'Escribe tu nombre completo para aceptar.');
  const bodyHash = sha256(exports.RENTAL_TERMS.version + exports.RENTAL_TERMS.body);
  const signedAt = new Date();
  await Contract.create({
    bandId: actor.bandId, kind: 'rental_terms', title: exports.RENTAL_TERMS.title, body: exports.RENTAL_TERMS.body, bodyHash, parties: [party],
    signatures: [{ key: 'leader', name: party.name, typedName: cleanString(typedName, 100), signedAt, sealHash: sha256(`${bodyHash}|leader|${signedAt.toISOString()}`) }],
    status: 'fully_signed', createdBy: `band:${actor.bandId}`
  });
  return exports.termsStatus(actor);
};
