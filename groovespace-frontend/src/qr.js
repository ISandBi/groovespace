// Generador de códigos QR propio (modo byte, corrección de errores M, versiones 1-10).
// Sin dependencias: el boleto funciona aunque no se pueda instalar ninguna librería.

const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

const alignPositions = (ver) => {
  if (ver === 1) return [];
  const count = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
  const list = [6];
  for (let pos = size - 7; list.length < count; pos -= step) list.splice(1, 0, pos);
  return list;
};

const rawModules = (ver) => {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const count = Math.floor(ver / 7) + 2;
    result -= (25 * count - 10) * count - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
};

const dataCodewords = (ver) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

const gfMul = (x, y) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
};

const rsDivisor = (degree) => {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 2);
  }
  return result;
};

const rsRemainder = (data, divisor) => {
  const result = divisor.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
  }
  return result;
};

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

const penalty = (m, size) => {
  let score = 0;
  for (let dir = 0; dir < 2; dir++) {
    for (let a = 0; a < size; a++) {
      const line = [];
      for (let b = 0; b < size; b++) line.push(dir ? m[b][a] : m[a][b]);
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (line[b] === line[b - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1;
      }
      const text = line.map((v) => (v ? 1 : 0)).join('');
      for (const pattern of ['10111010000', '00001011101']) {
        for (let i = text.indexOf(pattern); i >= 0; i = text.indexOf(pattern, i + 1)) score += 40;
      }
    }
  }
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (m[y][x]) dark++;
      if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
  }
  const total = size * size;
  return score + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
};

/** Devuelve { size, modules } donde modules[y][x] === true es un módulo oscuro. */
export function makeQr(text) {
  const bytes = new TextEncoder().encode(text);
  let ver = 1;
  while (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 > dataCodewords(ver) * 8) {
    ver++;
    if (ver > 10) throw new RangeError('Texto demasiado largo para el boleto QR.');
  }

  const bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  const capacity = dataCodewords(ver) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // Corrección de errores por bloque e intercalado.
  const blockCount = NUM_BLOCKS[ver];
  const eccLen = ECC_PER_BLOCK[ver];
  const rawCodewords = Math.floor(rawModules(ver) / 8);
  const shortBlocks = blockCount - (rawCodewords % blockCount);
  const shortLen = Math.floor(rawCodewords / blockCount);
  const divisor = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < blockCount; i++) {
    const part = data.slice(k, k + shortLen - eccLen + (i < shortBlocks ? 0 : 1));
    k += part.length;
    const ecc = rsRemainder(part, divisor);
    if (i < shortBlocks) part.push(0);
    blocks.push(part.concat(ecc));
  }
  const codewords = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => { if (i !== shortLen - eccLen || j >= shortBlocks) codewords.push(block[i]); });
  }

  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true; };
  const bit = (value, i) => ((value >>> i) & 1) !== 0;

  const drawFormat = (mask) => {
    const formatData = (0 << 3) | mask; // nivel M = 0
    let rem = formatData;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const formatBits = ((formatData << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(formatBits, i));
    setFn(8, 7, bit(formatBits, 6));
    setFn(8, 8, bit(formatBits, 7));
    setFn(7, 8, bit(formatBits, 8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(formatBits, i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(formatBits, i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(formatBits, i));
    setFn(8, size - 8, true);
  };

  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const positions = alignPositions(ver);
  positions.forEach((py, i) => positions.forEach((px, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === positions.length - 1) || (i === positions.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const versionBits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit(versionBits, i));
      setFn(b, a, bit(versionBits, i));
    }
  }

  // Colocar los codewords en zigzag.
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && index < codewords.length * 8) {
          modules[y][x] = bit(codewords[index >>> 3], 7 - (index & 7));
          index++;
        }
      }
    }
  }

  const applyMask = (mask) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFunction[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
  };
  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormat(mask);
    const score = penalty(modules, size);
    if (score < bestScore) { bestScore = score; bestMask = mask; }
    applyMask(mask);
  }
  applyMask(bestMask);
  drawFormat(bestMask);
  return { size, modules };
}

/** Trazado SVG (una sola ruta) con zona de silencio de 4 módulos alrededor. */
export function qrToSvgPath(qr, quiet = 4) {
  let path = '';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return { path, viewSize: qr.size + quiet * 2 };
}
