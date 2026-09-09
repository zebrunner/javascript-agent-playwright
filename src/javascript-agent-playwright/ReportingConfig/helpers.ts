import { isNotBlankString } from '../helpers';

export function getString(envVar: string, configValue: any, defaultValue: string = null): string {
  const envValue = process.env[envVar] as string;

  return isNotBlankString(envValue) ? envValue : isNotBlankString(configValue) ? configValue : defaultValue;
}

export function getBoolean(envVar: string, configValue: any, defaultValue = false): boolean {
  if (process.env[envVar]?.toLowerCase?.() === 'false') {
    return false;
  }

  if (process.env[envVar]?.toLowerCase?.() === 'true') {
    return true;
  }

  if (configValue === false || configValue?.toLowerCase?.() === 'false') {
    return false;
  }

  if (configValue === true || configValue?.toLowerCase?.() === 'true') {
    return true;
  }

  return defaultValue;
}

export function getNumber(envVar: string, configValue: any, defaultValue: number = null): number {
  return parseInt(process.env[envVar], 10) || parseInt(configValue, 10) || defaultValue;
}

// Unlike getNumber, an explicitly configured 0 is honoured instead of falling through to the default.
export function getNonNegativeNumber(envVar: string, configValue: any, defaultValue: number): number {
  const envValue = parseInt(process.env[envVar], 10);
  if (Number.isFinite(envValue) && envValue >= 0) {
    return envValue;
  }

  const parsedConfigValue = parseInt(configValue, 10);
  if (Number.isFinite(parsedConfigValue) && parsedConfigValue >= 0) {
    return parsedConfigValue;
  }

  return defaultValue;
}
