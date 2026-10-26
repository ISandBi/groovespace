const BandEmailDomain = require('../models/BandEmailDomain');

const DEFAULT_BAND_EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com'];

exports.ensureDefaultBandEmailDomains = async () => {
  await Promise.all(DEFAULT_BAND_EMAIL_DOMAINS.map((domain) =>
    BandEmailDomain.updateOne(
      { domain },
      { $setOnInsert: { domain, enabled: true } },
      { upsert: true }
    )
  ));
  return BandEmailDomain.find({ enabled: true }).sort({ domain: 1 }).select('domain -_id').lean();
};
