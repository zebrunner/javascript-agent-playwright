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
