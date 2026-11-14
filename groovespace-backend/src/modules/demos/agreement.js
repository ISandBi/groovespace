const crypto = require('crypto');

// Acuerdo que el ingeniero firma antes de escuchar un demo. Las firmas son electrónicas SIMULADAS
// (nombre escrito + sello del sistema); no tienen validez legal: la firma NOM-151 se integrará después.
const agreement = {
  version: 'demo-2026-11-v1',
  title: 'Acuerdo de uso y confidencialidad de demo',
  clauses: [
    'Finalidad. El demo se comparte únicamente para que el ingeniero evalúe a la banda y proponga un plan de trabajo. No se otorga ninguna licencia de explotación.',
    'Reproducción en línea. El archivo sólo puede escucharse o verse dentro de GrooveSpace. Queda prohibido descargarlo, grabarlo, capturarlo, convertirlo o redistribuirlo por cualquier medio.',
    'Titularidad. La banda conserva el 100% de los derechos de la composición y del fonograma. El ingeniero no adquiere derechos de autor, conexos ni de remezcla.',
    'Confidencialidad. El contenido del demo es confidencial y no se compartirá con terceros, ni se usará para entrenar sistemas de inteligencia artificial.',
    'Bitácora. GrooveSpace registra cuándo se escucha el demo y quién lo hizo, con fines de trazabilidad.',
    'Vigencia y responsabilidad. El acuerdo obliga por 24 meses; su incumplimiento puede dar lugar a la baja del ingeniero del directorio y a las acciones legales que correspondan.'
  ],
  grooveSpace: { company: 'GrooveSpace S.A. de C.V.', signatory: 'Sofía Mendoza Rivas', role: 'Representante legal', note: 'Firma ficticia con fines de demostración' }
};

agreement.hash = crypto.createHash('sha256').update(JSON.stringify({ v: agreement.version, c: agreement.clauses })).digest('hex');
module.exports = agreement;
