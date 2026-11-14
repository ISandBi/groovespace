// Punto de extensión para firma avanzada. Hoy sólo existe el proveedor 'internal' (firma con nombre escrito + sello SHA-256).
// Para conectar NOM-151 se implementa otro proveedor con la misma interfaz y se activa con CONTRACT_PROVIDER.
//
//   interface SignatureProvider {
//     name: string
//     createEnvelope(contract): Promise<{ externalEnvelopeId }>
//     onFullySigned(contract): Promise<{ nom151: { status, certificateRef, stampedAt } }>
//   }
const providers = {
  internal: {
    name: 'internal',
    createEnvelope: async () => ({ externalEnvelopeId: null }),
    onFullySigned: async () => ({ nom151: { status: 'not_connected' } })
  }
};

exports.getProvider = () => providers[process.env.CONTRACT_PROVIDER] || providers.internal;
exports.registerProvider = (name, implementation) => { providers[name] = implementation; };
