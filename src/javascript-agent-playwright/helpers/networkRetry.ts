const TRANSIENT_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNABORTED',
]);

const TRANSIENT_STATUSES = new Set([502, 503, 504]);

// A transient failure is a connection-level error or an upstream 5xx that a retry can recover.
export const isTransientNetworkError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && TRANSIENT_CODES.has(code)) {
    return true;
  }
  const status = (error as { response?: { status?: unknown } }).response?.status;
  return typeof status === 'number' && TRANSIENT_STATUSES.has(status);
};

export type NetworkRetryOptions = { retries: number; delayMs: number };

// Retries transient failures with exponential backoff; non-transient errors rethrow immediately.
export const withNetworkRetry = async <T>(op: () => Promise<T>, opts: NetworkRetryOptions): Promise<T> => {
  let attempt = 0;
  for (;;) {
    try {
      return await op();
    } catch (error) {
      if (attempt >= opts.retries || !isTransientNetworkError(error)) {
        throw error;
      }
      if (opts.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, opts.delayMs * 2 ** attempt));
      }
      attempt += 1;
    }
  }
};
