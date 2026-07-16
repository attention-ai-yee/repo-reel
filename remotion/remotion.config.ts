import {Config} from '@remotion/cli/config';
import {existsSync, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setConcurrency(4);

const explicitBrowser = process.env.REMOTION_BROWSER_EXECUTABLE;
if (explicitBrowser && existsSync(explicitBrowser)) {
  Config.setBrowserExecutable(explicitBrowser);
} else if (process.platform === 'win32') {
  const playwrightRoot = path.join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (existsSync(playwrightRoot)) {
    const chromiumDirs = readdirSync(playwrightRoot)
      .filter((entry) => entry.startsWith('chromium-'))
      .sort()
      .reverse();
    const browser = chromiumDirs
      .map((entry) => path.join(playwrightRoot, entry, 'chrome-win64', 'chrome.exe'))
      .find((candidate) => existsSync(candidate));
    if (browser) Config.setBrowserExecutable(browser);
  }
}
