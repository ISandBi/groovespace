// Ingenieros de audio. demoKinds indica qué tipo de demo pueden evaluar:
// 'audio' = pista de audio; 'video' = grabación en vivo (el ingeniero de sonido en vivo la necesita).
exports.engineers = [
  { id: 'eng-ana', key: 'ANA', name: 'Ana Torres', specialty: 'Grabación vocal y producción', genres: ['Pop', 'Indie', 'Folk'], hourlyRate: 180, demoKinds: ['audio'] },
  { id: 'eng-mateo', key: 'MATEO', name: 'Mateo Ruiz', specialty: 'Mezcla y sonido en vivo', genres: ['Rock', 'Metal', 'Punk'], hourlyRate: 200, demoKinds: ['video'] },
  { id: 'eng-lucia', key: 'LUCIA', name: 'Lucía Vega', specialty: 'Producción musical y arreglos', genres: ['Orquesta', 'Jazz', 'Clásica'], hourlyRate: 220, demoKinds: ['audio', 'video'] },
  { id: 'eng-diego', key: 'DIEGO', name: 'Diego Salas', specialty: 'Masterización y acústica', genres: ['Electrónica', 'Rock', 'Hip hop'], hourlyRate: 190, demoKinds: ['audio'] }
];

exports.publicEngineer = ({ id, name, specialty, genres, hourlyRate, demoKinds }) => ({ id, name, specialty, genres, hourlyRate, demoKinds });
