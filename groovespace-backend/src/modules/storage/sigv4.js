const crypto = require('crypto');

// URLs prefirmadas de AWS Signature Version 4 para S3 (y compatibles: MinIO, Cloudflare R2, Backblaze).
// Se implementa a mano para no depender del SDK completo de AWS.
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const encodePath = (path) => path.split('/').map(encode).join('/');

/**
 * @returns URL completa con la firma en la cadena de consulta.
 * Los encabezados que no se firman (p. ej. Range) pueden añadirse libremente al usar la URL.
 */
exports.presignUrl = ({ method = 'GET', protocol = 'https', host, path, region, accessKeyId, secretAccessKey, sessionToken, expires = 300, now = new Date(), service = 's3', query = {} }) => {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  const params = {
    ...query,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
    ...(sessionToken ? { 'X-Amz-Security-Token': sessionToken } : {})
  };
  const canonicalQuery = Object.keys(params).sort().map((key) => `${encode(key)}=${encode(params[key])}`).join('&');
  const canonicalPath = encodePath(path);
  const canonicalRequest = [method, canonicalPath, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return `${protocol}://${host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
};
