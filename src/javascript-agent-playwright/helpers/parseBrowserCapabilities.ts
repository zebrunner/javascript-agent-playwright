import UAParser from 'ua-parser-js';
import * as os from 'os';

export const parseBrowserCapabilities = (launchInfo) => {
  const parser = new UAParser();
  parser.setUA(launchInfo.use.userAgent);

  const browserCapabilities = parser.getResult();
  // rewrite platform from pw userAgent string with node.js os since pw userAgent string always points to Windows
  browserCapabilities.os.name = os.platform();

  return browserCapabilities;
};
