import UAParser from 'ua-parser-js';

export const parseBrowserCapabilities = (launchInfo) => {
  const parser = new UAParser();
  parser.setUA(launchInfo.use.userAgent);

  return parser.getResult();
};
