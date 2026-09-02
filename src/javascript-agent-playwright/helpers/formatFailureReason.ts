import { cleanseReason } from './cleanseReason';

type Failure = {
  message?: string;
  stack?: string;
};

export const formatFailureReason = (failure?: Failure): string => {
  const message = cleanseReason(failure?.message).trim();
  const stack = cleanseReason(failure?.stack).trim();

  if (!stack) return message;
  if (!message || stack.includes(message)) return stack;
  return `${message}\n${stack}`;
};
