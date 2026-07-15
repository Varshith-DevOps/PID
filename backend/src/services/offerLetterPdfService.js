const { renderOfferLetterHtml } = require('../templates/offerLetterTemplate');

const generateOfferLetterPdf = async (offerData) => {
  const { default: puppeteer } = await import('puppeteer');
  const html = renderOfferLetterHtml(offerData);
  const launchOptions = {
    headless: true,
    args: process.env.NODE_ENV === 'production'
      ? ['--no-sandbox', '--disable-setuid-sandbox']
      : [],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });
  } finally {
    await browser.close();
  }
};

module.exports = {
  generateOfferLetterPdf,
};
