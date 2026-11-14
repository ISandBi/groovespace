const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { presignUrl } = require('../src/modules/storage/sigv4');
const { sniffMedia, parseRange } = require('../src/modules/storage/media');

test('SigV4 coincide con el ejemplo oficial de AWS (GET prefirmado)', () => {
  const url = presignUrl({
    method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    expires: 86400, now: new Date('2013-05-24T00:00:00Z')
  });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
});

test('detecta formatos por contenido, no por extensión', () => {
  const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt ')]);
  assert.deepEqual(sniffMedia(wav), { kind: 'audio', mime: 'audio/wav', ext: 'wav', lossless: true });
  assert.equal(sniffMedia(Buffer.concat([Buffer.from('fLaC'), Buffer.alloc(12)])).lossless, true);
  assert.equal(sniffMedia(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(4)])).kind, 'video');
  assert.equal(sniffMedia(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(4)])).kind, 'audio');
  assert.equal(sniffMedia(Buffer.concat([Buffer.from('MZ'), Buffer.alloc(20)])), null); // un .exe renombrado a .wav no pasa
});

test('interpreta rangos HTTP', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.equal(parseRange('bytes=2000-', 1000), 'invalid');
  assert.equal(parseRange('items=0-1', 1000), 'invalid');
  assert.equal(parseRange(undefined, 1000), null);
});

test('el almacenamiento local guarda, lee por rango y conserva los bytes originales', async () => {
  process.env.STORAGE_DRIVER = 'local';
  process.env.STORAGE_LOCAL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-store-'));
  const storage = require('../src/modules/storage');
  const source = path.join(process.env.STORAGE_LOCAL_DIR, 'in.bin');
  const bytes = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 251));
  fs.writeFileSync(source, bytes);
  const key = storage.newKey('demos/test', 'wav');
  const stored = await storage.store({ key, filePath: source, size: bytes.length, contentType: 'audio/wav' });
  assert.equal(stored.sha256, require('crypto').createHash('sha256').update(bytes).digest('hex'));
  const chunks = [];
  for await (const chunk of await storage.driver().open(key, { start: 10, end: 19 })) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), bytes.subarray(10, 20));
  await assert.rejects(() => storage.store({ key: '../escape.wav', filePath: source, size: 1 }), /no válida/);
  await storage.remove(key);
});
