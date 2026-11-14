// Utilidades de medios: detección por contenido real (no por extensión), metadatos con ffprobe y rangos HTTP.
const { spawn } = require('child_process');
const fs = require('fs/promises');

const ASCII = (buffer, start, end) => buffer.toString('latin1', start, end);

/** Identifica el formato por sus primeros bytes. Devuelve { kind, mime, ext, lossless } o null. */
exports.sniffMedia = (buffer) => {
  if (buffer.length < 12) return null;
  if (ASCII(buffer, 0, 4) === 'RIFF' && ASCII(buffer, 8, 12) === 'WAVE') return { kind: 'audio', mime: 'audio/wav', ext: 'wav', lossless: true };
  if (ASCII(buffer, 0, 4) === 'fLaC') return { kind: 'audio', mime: 'audio/flac', ext: 'flac', lossless: true };
  if (ASCII(buffer, 0, 4) === 'OggS') return { kind: 'audio', mime: 'audio/ogg', ext: 'ogg', lossless: false };
  if (ASCII(buffer, 0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3', lossless: false };
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return { kind: 'video', mime: 'video/webm', ext: 'webm', lossless: false };
  if (ASCII(buffer, 4, 8) === 'ftyp') {
    const brand = ASCII(buffer, 8, 12);
    if (brand === 'M4A ' || brand === 'M4B ') return { kind: 'audio', mime: 'audio/mp4', ext: 'm4a', lossless: false };
    if (brand === 'qt  ') return { kind: 'video', mime: 'video/quicktime', ext: 'mov', lossless: false };
    return { kind: 'video', mime: 'video/mp4', ext: 'mp4', lossless: false };
  }
  return null;
};

exports.readHead = async (filePath, bytes = 16) => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

/** Metadatos técnicos con ffprobe si está instalado (opcional). Nunca falla la subida. */
exports.probe = (filePath) => new Promise((resolve) => {
  let output = '';
  let child;
  try {
    child = spawn('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath], { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return resolve(null); }
  const timer = setTimeout(() => { child.kill(); resolve(null); }, 15000);
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.on('error', () => { clearTimeout(timer); resolve(null); });
  child.on('close', () => {
    clearTimeout(timer);
    try {
      const data = JSON.parse(output);
      const audio = (data.streams || []).find((stream) => stream.codec_type === 'audio');
      const video = (data.streams || []).find((stream) => stream.codec_type === 'video');
      resolve({
        durationSec: Number(data.format?.duration) || undefined,
        bitrate: Number(data.format?.bit_rate) || undefined,
        codec: audio?.codec_name,
        sampleRate: Number(audio?.sample_rate) || undefined,
        channels: audio?.channels,
        bitDepth: Number(audio?.bits_per_raw_sample || audio?.bits_per_sample) || undefined,
        width: video?.width,
        height: video?.height
      });
    } catch { resolve(null); }
  });
});

/** Interpreta `Range: bytes=a-b`. Devuelve {start,end} | null (sin rango) | 'invalid'. */
exports.parseRange = (header, size) => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid';
  let start;
  let end;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!suffix) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start > end || start >= size ? 'invalid' : { start, end };
};
