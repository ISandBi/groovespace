const crypto = require('crypto');

// Paleta de GrooveSpace (mismos valores que las variables CSS del sitio).
const PALETTE = [
  { bg: '#c2ff3c', fg: '#100d17', accent: '#ff5d8f' },
  { bg: '#ff5d8f', fg: '#100d17', accent: '#c2ff3c' },
  { bg: '#b28aff', fg: '#100d17', accent: '#c2ff3c' },
  { bg: '#ffb84d', fg: '#100d17', accent: '#b28aff' },
  { bg: '#1d1725', fg: '#c2ff3c', accent: '#ff5d8f' }
];

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

exports.initials = (name) => {
  const words = String(name || 'GS').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join('') : (words[0] || 'GS').slice(0, 2);
  return letters.toUpperCase();
};

/** Logo provisional determinista: mismo nombre → mismo logo. Ondas de sonido + iniciales. */
exports.buildProvisionalLogo = (name) => {
  const hash = crypto.createHash('sha256').update(String(name || '')).digest();
  const colors = PALETTE[hash[0] % PALETTE.length];
  const bars = Array.from({ length: 9 }, (_, i) => 10 + (hash[i + 1] % 26));
  const barSvg = bars.map((height, i) => `<rect x="${28 + i * 18}" y="${196 - height}" width="10" height="${height}" rx="5" fill="${colors.accent}" opacity="0.9"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" role="img" aria-label="Logo provisional de ${escapeXml(name)}">
<rect width="220" height="220" rx="44" fill="${colors.bg}"/>
<circle cx="170" cy="50" r="16" fill="${colors.accent}" opacity="0.85"/>
<text x="110" y="132" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="84" fill="${colors.fg}">${escapeXml(exports.initials(name))}</text>
${barSvg}
</svg>`;
};

exports.provisionalLogoPath = (name) => `/api/branding/logo.svg?name=${encodeURIComponent(String(name || '').slice(0, 80))}`;
