import { chromium } from 'playwright-core';

const TOKEN = '2VVqMtRt3SFVNki43fc3758824c36ed670786acd63e902701';
const WS_ENDPOINT = `wss://production-sfo.browserless.io/chromium/playwright?token=${TOKEN}`;

async function run() {
  const browser = await chromium.connect(WS_ENDPOINT);

  try {
    const page = await browser.newPage();

    await page.goto('https://zakelijkbestellen-coolblue.nl/checkout', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });

    // Fill required fields
    await page.locator('input[autocomplete="organization"]').fill('Mijn Bedrijf BV');
    await page.locator('input[autocomplete="given-name"]').fill('Jan');
    await page.locator('input[autocomplete="family-name"]').fill('Jansen');
    await page.locator('input[type="email"][autocomplete="email"]').fill('jan@example.com');
    await page.locator('input[autocomplete="tel"]').fill('0612345678');
    await page.locator('input[autocomplete="address-line1"]').fill('Hoofdstraat');

    // Verified from the live DOM: required house number field in the address section
    await page.locator('section.co-card:nth-of-type(3) input:not([autocomplete])[required]').fill('12');

    await page.locator('input[autocomplete="postal-code"]').fill('1234 AB');
    await page.locator('input[autocomplete="address-level2"]').fill('Amsterdam');

    // Wait until the verified checkout button becomes enabled
    await page.waitForFunction(() => {
      const btn = document.querySelector('button.co-submit');
      return !!btn && !btn.disabled;
    }, { timeout: 30000 });

    // Click and wait until the final iDEAL transaction URL is reached
    await Promise.all([
      page.waitForURL(/^https:\/\/pay\.ideal\.nl\/transactions\/.+/i, {
        timeout: 90000,
      }),
      page.click('button.co-submit'),
    ]);

    const finalUrl = page.url();

    console.log(JSON.stringify({
      success: true,
      finalUrl,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2));
    process.exitCode = 1;
  }
}

run();

npm install playwright-core
node browserless-ideal.js