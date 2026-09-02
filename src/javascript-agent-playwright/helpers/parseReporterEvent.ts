import { EVENT_NAMES } from '../constants/events';

export type ReporterEvent = {
  eventType: string;
  payload?: any;
};

const knownEventNames = new Set(Object.values(EVENT_NAMES));

export const parseReporterEvent = (value: string): ReporterEvent | null => {
  try {
    const event = JSON.parse(value);
    if (!event || typeof event !== 'object' || !knownEventNames.has(event.eventType)) {
      return null;
    }
    return event;
  } catch {
    return null;
  }
};
