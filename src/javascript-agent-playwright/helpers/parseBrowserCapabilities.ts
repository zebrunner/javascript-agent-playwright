import UAParser from 'ua-parser-js';
import * as os from 'os';

const normalize = (value?: string) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const defaultBrowserForPlatform = (platformName?: string) => {
  switch ((platformName || '').toLowerCase()) {
    case 'ios':
      return 'Safari';
    case 'android':
      return 'Chrome';
    default:
      return undefined;
  }
};

export const parseBrowserCapabilities = (launchInfo) => {
  const parser = new UAParser();
  const userAgent = normalize(launchInfo?.use?.userAgent);
  if (userAgent) {
    parser.setUA(userAgent);
  }

  const browserCapabilities = parser.getResult();
  const capabilities = launchInfo?.use?.capabilities || {};
  const platformName = normalize(capabilities.platformName);
  const browserName = normalize(capabilities.browserName || capabilities.browser);
  const browserVersion = normalize(capabilities.browserVersion || capabilities.version);
  const platformVersion = normalize(capabilities.osVersion || capabilities.platformVersion);

  browserCapabilities.browser.name =
    browserName || browserCapabilities.browser.name || defaultBrowserForPlatform(platformName);
  browserCapabilities.browser.version = browserVersion || browserCapabilities.browser.version;
  browserCapabilities.os.name = platformName || os.platform();
  browserCapabilities.os.version = platformVersion || browserCapabilities.os.version;

  return browserCapabilities;
};
