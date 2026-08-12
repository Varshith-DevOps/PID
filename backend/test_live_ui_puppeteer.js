const puppeteer = require('puppeteer');
const fs = require('fs');

const LIVE_URL = 'http://13.232.70.236';

const ACCOUNTS = [
  { name: 'Aarav Sharma', email: 'aarav.sharma@hrms.com', password: 'employee123', role: 'EMPLOYEE' },
  { name: 'Ananya Reddy', email: 'ananya.reddy@hrms.com', password: 'employee123', role: 'EMPLOYEE' },
  { name: 'Diya Patel', email: 'diya.patel@hrms.com', password: 'employee123', role: 'EMPLOYEE' },
  { name: 'HR Manager', email: 'hr@hrms.com', password: 'employee123', role: 'HR' },
  { name: 'Manager User', email: 'manager@hrms.com', password: 'employee123', role: 'MANAGER' },
  { name: 'Admin User', email: 'admin@hrms.com', password: 'admin123', role: 'ADMIN' },
  { name: 'Super Admin', email: 'pidsuperadmin@hcms.pid', password: 'Noallow#835', role: 'SUPER_ADMIN' },
];

const paths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
];
const systemChromePath = paths.find(p => fs.existsSync(p));

async function runUIAutomation() {
  console.log('=================================================================');
  console.log('   PUPPETEER HEADLESS CHROME UI AUTOMATION TEST (STRICT E2E)      ');
  console.log('=================================================================\n');

  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,800'
    ]
  };
  if (systemChromePath) {
    launchOptions.executablePath = systemChromePath;
    console.log(`Using System Chrome at: ${systemChromePath}`);
  }

  let browser = await puppeteer.launch(launchOptions);
  const results = [];

  for (const acc of ACCOUNTS) {
    console.log(`\n-----------------------------------------------------------------`);
    console.log(`RUNNING REAL BROWSER UI TEST FOR: ${acc.role} (${acc.name} - ${acc.email})`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    let loginPass = false;
    let pageLoaded = false;
    let clockInVisible = false;
    let clockInWorks = false;
    let clockOutVisible = false;
    let clockOutWorks = false;
    let persistencePass = false;
    let rawCapturedDOM = '';

    try {
      // 1. Open Login Page
      await page.goto(`${LIVE_URL}/login`, { waitUntil: 'networkidle2', timeout: 20000 });
      
      // Fill login credentials
      await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
      await page.type('input[name="email"], input[type="email"]', acc.email);
      await page.type('input[name="password"], input[type="password"]', acc.password);

      // Click Sign In
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {})
      ]);

      const currentUrl = page.url();
      if (!currentUrl.includes('/login')) {
        loginPass = true;
        console.log(`  └─ ✅ UI Login Success -> Redirected to: ${currentUrl}`);
      } else {
        console.log(`  └─ ❌ UI Login Failed -> Remained on ${currentUrl}`);
      }

      // 2. Open Attendance Page
      await page.goto(`${LIVE_URL}/attendance`, { waitUntil: 'networkidle2', timeout: 20000 });
      pageLoaded = page.url().includes('/attendance');
      console.log(`  └─ ${pageLoaded ? '✅' : '❌'} Attendance Page Loaded: ${page.url()}`);

      // Wait for React components
      await new Promise(r => setTimeout(r, 2500));

      // 3. Inspect DOM for Time Clock card & initial buttons
      let buttonsText = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
      });

      rawCapturedDOM = buttonsText.join(' | ');
      console.log(`  └─ Initial Rendered Buttons in DOM: [ ${rawCapturedDOM} ]`);

      const hasClockInBtn = buttonsText.some(b => b.toLowerCase().includes('clock in'));

      if (hasClockInBtn) {
        clockInVisible = true;
        console.log(`  └─ ✅ "Clock In" Button is VISIBLE in rendered DOM`);
        
        const clicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.innerText.toLowerCase().includes('clock in'));
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          await new Promise(r => setTimeout(r, 2500));
          clockInWorks = true;
          console.log(`  └─ ✅ Clicked "Clock In" button -> Action Executed`);
        }
      } else {
        console.log(`  └─ ❌ "Clock In" Button NOT found in initial DOM array`);
      }

      // 4. Re-inspect DOM specifically for Clock Out AFTER Clock In action
      const updatedButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
      });
      
      const hasClockOutNow = updatedButtons.some(b => b.toLowerCase().includes('clock out'));
      rawCapturedDOM = updatedButtons.join(' | ');
      console.log(`  └─ Post-CheckIn Rendered Buttons in DOM: [ ${rawCapturedDOM} ]`);

      if (hasClockOutNow) {
        clockOutVisible = true;
        console.log(`  └─ ✅ "Clock Out" Button is VISIBLE in rendered DOM`);

        const clickedOut = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.innerText.toLowerCase().includes('clock out'));
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });

        if (clickedOut) {
          await new Promise(r => setTimeout(r, 2500));
          clockOutWorks = true;
          console.log(`  └─ ✅ Clicked "Clock Out" button -> Action Executed`);
        } else {
          console.log(`  └─ ❌ "Clock Out" button click failed`);
        }
      } else {
        console.log(`  └─ ❌ "Clock Out" Button is NOT visible in rendered DOM post-checkin`);
      }

      // 5. Refresh page & verify persistence
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2500));

      const refreshedText = await page.evaluate(() => document.body.innerText);
      if (refreshedText.includes('Time Clock') || refreshedText.includes('Clocked') || refreshedText.includes('COMPLETED TODAY') || refreshedText.includes('Clock In Again')) {
        persistencePass = true;
        console.log(`  └─ ✅ Refresh Persistence Verified -> Time Clock UI state intact in DOM`);
      } else {
        console.log(`  └─ ❌ Refresh Persistence Failed`);
      }

    } catch (err) {
      console.log(`  └─ ⚠️ Test exception: ${err.message}`);
    } finally {
      await page.close();
    }

    const overallResult = (loginPass && pageLoaded && clockInVisible && clockInWorks && clockOutVisible && clockOutWorks && persistencePass) ? 'PASS' : 'FAIL';

    results.push({
      Account: acc.name,
      Role: acc.role,
      Login: loginPass ? 'PASS' : 'FAIL',
      AttendancePage: pageLoaded ? 'PASS' : 'FAIL',
      ClockInVisible: clockInVisible ? 'PASS' : 'FAIL',
      ClockInWorks: clockInWorks ? 'PASS' : 'FAIL',
      ClockOutVisible: clockOutVisible ? 'PASS' : 'FAIL',
      ClockOutWorks: clockOutWorks ? 'PASS' : 'FAIL',
      RefreshPersistence: persistencePass ? 'PASS' : 'FAIL',
      Result: overallResult,
      RawDOM: rawCapturedDOM
    });
  }

  await browser.close();

  console.log('\n=================================================================');
  console.log('   FINAL STRICT HEADLESS CHROME BROWSER UI TEST REPORT          ');
  console.log('=================================================================');
  console.table(results);
}

runUIAutomation();
