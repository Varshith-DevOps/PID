const fs = require('fs/promises');
const path = require('path');

const sanitizeFileName = (value) => String(value || 'offer-letter')
  .replace(/[^a-z0-9-_ ]/gi, '')
  .trim()
  .replace(/\s+/g, '-')
  .slice(0, 120) || 'offer-letter';

const getStorageDir = () => {
  const configured = process.env.OFFER_STORAGE_DIR || 'uploads/offers';
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
};

const buildOfferFileName = ({ candidateName, jobTitle }) => (
  `${sanitizeFileName(`Offer-Letter-${candidateName}-${jobTitle}`)}.pdf`
);

const writeOfferPdf = async ({ offerId, fileName, buffer }) => {
  const storageDir = getStorageDir();
  await fs.mkdir(storageDir, { recursive: true });
  const safeName = sanitizeFileName(fileName.replace(/\.pdf$/i, '')) + '.pdf';
  const storageKey = `${offerId}-${safeName}`;
  await fs.writeFile(path.join(storageDir, storageKey), buffer);
  return { fileName: safeName, storageKey };
};

const readOfferPdf = async (storageKey) => {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) {
    const error = new Error('Invalid offer storage key.');
    error.code = 'INVALID_STORAGE_KEY';
    throw error;
  }
  return fs.readFile(path.join(getStorageDir(), storageKey));
};

module.exports = {
  buildOfferFileName,
  writeOfferPdf,
  readOfferPdf,
  sanitizeFileName,
};
