const fs = require('fs');
const http = require('http');
const https = require('https');
const { presignUrl } = require('./sigv4');

// Driver S3 / compatible. Variables: S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
// y opcionalmente S3_ENDPOINT (MinIO, R2…) y S3_FORCE_PATH_STYLE=true.
const config = () => {
  const { S3_BUCKET: bucket, S3_REGION: region = 'us-east-1', S3_ACCESS_KEY_ID: accessKeyId, S3_SECRET_ACCESS_KEY: secretAccessKey, S3_ENDPOINT: endpoint } = process.env;
  if (!bucket || !accessKeyId || !secretAccessKey) throw new Error('El almacenamiento S3 no está configurado (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).');
  return { bucket, region, accessKeyId, secretAccessKey, endpoint, pathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' || Boolean(endpoint) };
};

const signed = (method, key, { expires = 300 } = {}) => {
  const cfg = config();
  const target = cfg.endpoint ? new URL(cfg.endpoint) : { protocol: 'https:', host: cfg.pathStyle ? `s3.${cfg.region}.amazonaws.com` : `${cfg.bucket}.s3.${cfg.region}.amazonaws.com` };
  const path = cfg.pathStyle ? `/${cfg.bucket}/${key}` : `/${key}`;
  return presignUrl({ method, protocol: target.protocol.replace(':', ''), host: target.host, path, region: cfg.region, accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, sessionToken: process.env.S3_SESSION_TOKEN, expires });
};
exports.signedUrl = signed;

const send = (url, { method, headers = {}, body }) => new Promise((resolve, reject) => {
  const client = url.startsWith('https:') ? https : http;
  const request = client.request(url, { method, headers }, resolve);
  request.on('error', reject);
  if (body) body.on('error', reject).pipe(request); else request.end();
});

const ensureOk = (response, action) => {
  if (response.statusCode >= 200 && response.statusCode < 300) return response;
  response.resume();
  throw new Error(`S3 respondió ${response.statusCode} al ${action}.`);
};

exports.name = 's3';

exports.put = async ({ key, filePath, size, contentType = 'application/octet-stream' }) => {
  const response = await send(signed('PUT', key, { expires: 3600 }), {
    method: 'PUT',
    headers: { 'Content-Length': size, 'Content-Type': contentType },
    body: fs.createReadStream(filePath)
  });
  ensureOk(response, 'subir el archivo');
  response.resume();
};

exports.head = async (key) => {
  const response = ensureOk(await send(signed('HEAD', key), { method: 'HEAD' }), 'consultar el archivo');
  response.resume();
  return { size: Number(response.headers['content-length']) };
};

exports.open = async (key, { start, end } = {}) => {
  const headers = start === undefined ? {} : { Range: `bytes=${start}-${end}` };
  return ensureOk(await send(signed('GET', key), { method: 'GET', headers }), 'leer el archivo');
};

exports.remove = async (key) => {
  const response = await send(signed('DELETE', key), { method: 'DELETE' });
  response.resume();
};
