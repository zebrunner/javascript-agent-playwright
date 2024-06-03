import log from 'loglevel';
import { EVENT_NAMES } from './constants/events';
import { isNotBlankString, isNotEmptyArray } from './helpers';

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
      const payload = JSON.stringify({ eventType, payload: { message, timestamp: new Date().getTime() } });

      process.stdout.write(payload);
    } else {
      logger.warn(`Message must be a not blank string. Provided value is '${message}'`);
    }
  },

  attachLabel: (key: string, ...values: string[]) => {
    if (!isNotBlankString(key)) {
      logger.warn(`Label key must be a not blank string. Provided value is '${key}'`);
      return;
    }
    if (!isNotEmptyArray(values)) {
      logger.warn(`You must provide at least one label value. The label with the key '${key}' has none`);
      return;
    }

    values = values.filter((value) => {
      const isNotBlank = isNotBlankString(value);
      if (!isNotBlank) {
        logger.warn(`Label value must be a not blank string. Provided value for key '${key}' is '${value}'`);
      }
      return isNotBlank;
    });

    if (isNotEmptyArray(values)) {
      const eventType = EVENT_NAMES.ATTACH_TEST_LABELS;
      const payload = JSON.stringify({ eventType, payload: { key, values } });

      process.stdout.write(payload);
    }
  },

  attachArtifactReference: (name: string, value: string) => {
    if (!isNotBlankString(name)) {
      logger.warn(`Artifact reference name must be a not blank string. Provided value is '${name}'`);
      return;
    }
    if (!isNotBlankString(value)) {
      logger.warn(
        `Artifact reference value must be a not blank string. Provided value for name '${value}' is '${value}'`,
      );
      return;
    }

    const eventType = EVENT_NAMES.ATTACH_TEST_ARTIFACT_REFERENCES;
    const payload = JSON.stringify({ eventType, payload: { name, value } });

    process.stdout.write(payload);
  },

  revertRegistration: () => {
    const eventType = EVENT_NAMES.REVERT_TEST_REGISTRATION;
    process.stdout.write(JSON.stringify({ eventType }));
  },
};
