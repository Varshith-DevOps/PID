const fs = require('fs');
const puppeteer = require('puppeteer');

const paths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
];

let chromePath = paths.find(p => fs.existsSync(p));
console.log('Found Chrome Path:', chromePath || 'None (Using bundled Chromium)');

async function run() {
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=IsolateOrigins', '--disable-site-isolation-trials']
  };
  if (chromePath) launchOptions.executablePath = chromePath;

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  try {
    const res = await page.goto('http://13.232.70.236/login', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('Page Nav Status:', res.status());
    console.log('Page Title:', await page.title());
  } catch (err) {
    console.error('Nav Error:', err.message);
  } finally {
    await browser.close();
  }
}

run();
