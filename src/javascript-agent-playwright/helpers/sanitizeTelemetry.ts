import { stripTerminalCodes } from './stripTerminalCodes';

const sensitiveKey =
  '(?:password|passwd|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|x[_-]?api[_-]?key|authorization|cookie|set-cookie|client[_-]?secret)';
const sensitiveKeys = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'xapikey',
  'authorization',
  'cookie',
  'setcookie',
  'clientsecret',
]);
const isSensitiveKey = (key: string): boolean => sensitiveKeys.has(key.toLowerCase().replace(/[^a-z0-9]/g, ''));

const redactString = (value: string): string =>
  value
    .replace(/((?:authorization|proxy-authorization)\s*[:=]\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(/((?:cookie|set-cookie)\s*[:=]\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(new RegExp(`([?&]${sensitiveKey}=)[^&#\\s"'\\\`]+`, 'gi'), '$1[REDACTED]')
    .replace(new RegExp(`((?:${sensitiveKey})\\s*[:=]\\s*)(?:Bearer\\s+)?[^\\s,;]+`, 'gi'), '$1[REDACTED]')
    .replace(new RegExp(`(["']?${sensitiveKey}["']?\\s*:\\s*)["'][^"']*["']`, 'gi'), '$1"[REDACTED]"');

export const sanitizeLogMessage = (value: string, maxLength: number): string => {
  const redacted = redactString(stripTerminalCodes(value));
  if (redacted.length <= maxLength) return redacted;
  return `${redacted.slice(0, Math.max(0, maxLength - 14))}… [truncated]`;
};

export const sanitizeTelemetryValue = (value: unknown, maxLength = 8000): unknown => {
  const seen = new WeakSet<object>();

  const visit = (input: unknown, key?: string, depth = 0): unknown => {
    if (key && isSensitiveKey(key)) return '[REDACTED]';
    if (typeof input === 'string') return sanitizeLogMessage(input, maxLength);
    if (typeof input === 'bigint' || typeof input === 'symbol' || typeof input === 'function') return String(input);
    if (!input || typeof input !== 'object') return input;
    if (Buffer.isBuffer(input)) return `[Buffer ${input.length} bytes]`;
    if (ArrayBuffer.isView(input)) return `[${input.constructor.name} ${input.byteLength} bytes]`;
    if (input instanceof ArrayBuffer) return `[ArrayBuffer ${input.byteLength} bytes]`;
    if (seen.has(input)) return '[Circular]';
    if (depth >= 6) return '[Object]';
    seen.add(input);
    if (Array.isArray(input)) {
      const values = input.slice(0, 50).map((item) => visit(item, undefined, depth + 1));
      if (input.length > values.length) values.push(`[${input.length - values.length} more items]`);
      return values;
    }
    const propertyKeys = Reflect.ownKeys(input);
    const entries = propertyKeys.slice(0, 100).map((propertyKey) => [
      String(propertyKey),
      Object.getOwnPropertyDescriptor(input, propertyKey),
    ] as const);
    const result = Object.fromEntries(
      entries.map(([entryKey, descriptor]) => [
        entryKey,
        descriptor && 'value' in descriptor
          ? visit(descriptor.value, entryKey, depth + 1)
          : '[Accessor]',
      ]),
    );
    if (propertyKeys.length > entries.length) {
      result.__truncated__ = `${propertyKeys.length - entries.length} more properties`;
    }
    return result;
  };

  try {
    const sanitized = visit(value);
    const serialized = JSON.stringify(sanitized);
    if (!serialized || Buffer.byteLength(serialized) <= maxLength) return sanitized;
    return {
      truncated: true,
      originalBytes: Buffer.byteLength(serialized),
      preview: sanitizeLogMessage(serialized, Math.floor(maxLength / 2)),
    };
  } catch {
    return '[Unserializable]';
  }
};
