import log from 'loglevel';
import { EVENT_NAMES } from './constants/events';
import { isNotBlankString } from './helpers';

const logger = log.getLogger('zebrunner');

export const CurrentTest = {
  setMaintainer: (maintainer: string): void => {
    if (isNotBlankString(maintainer)) {
      const eventType = EVENT_NAMES.SET_MAINTAINER;
      const payload = JSON.stringify({ eventType, payload: maintainer });

      process.stdout.write(payload);
    } else {
      logger.warn(`Maintainer must be a not blank string. Provided value is '${maintainer}'`);
    }
  },
  addLog: (message: string): void => {
    if (isNotBlankString(message)) {
      const eventType = EVENT_NAMES.ADD_TEST_LOG;
      const payload = JSON.stringify({ eventType, payload: message });

      process.stdout.write(payload);
    } else {
      logger.warn(`Message must be a not blank string. Provided value is '${message}'`);
    }
  },
};
