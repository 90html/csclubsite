/* Find a Chromium/Chrome binary for the tooling scripts (brand + test).
 * Set CHROME_PATH to override. */
import { existsSync, readdirSync } from 'node:fs';

export function findChrome() {
  const candidates = [process.env.CHROME_PATH];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(pw)) {
    for (const dir of readdirSync(pw).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      candidates.push(`${pw}/${dir}/chrome-linux/chrome`);
    }
  }
  candidates.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  );
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('No Chrome/Chromium found. Set CHROME_PATH to your browser executable.');
  return found;
}
