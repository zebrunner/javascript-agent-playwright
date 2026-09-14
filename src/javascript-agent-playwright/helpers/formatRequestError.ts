type RequestErrorShape = {
  config?: { method?: string; baseURL?: string; url?: string };
  code?: string;
  response?: { data?: unknown };
  stack?: string;
};

// Builds the axios failure line from error.config/error.code, since connection-level errors leave error.request empty.
export const formatRequestError = (error: unknown): string => {
  const err = (error || {}) as RequestErrorShape;
  const { config, code, response, stack } = err;

  let message = '';
  if (config) {
    const method = config.method ? String(config.method).toUpperCase() : 'UNKNOWN';
    const target = `${config.baseURL || ''}${config.url || ''}`;
    message += `Could not send request ${method} ${target}${code ? ` (${code})` : ''}\n\n`;
  }
  if (response) {
    message += `Raw response\n${JSON.stringify(response.data)}\n\n`;
  }
  if (stack) {
    message += stack;
  }
  return message;
};
