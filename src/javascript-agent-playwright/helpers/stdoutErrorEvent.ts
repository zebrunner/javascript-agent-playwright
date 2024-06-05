import { EVENT_NAMES } from '../constants/events';

export const stdoutErrorEvent = (stage: string, message: string) => {
  process.stdout.write(
    JSON.stringify({
      eventType: EVENT_NAMES.LOG_ERROR,
      payload: {
        stage: stage,
        message: message,
      },
    }),
  );
};
