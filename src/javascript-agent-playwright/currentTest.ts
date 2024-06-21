import { EVENT_NAMES } from './constants/events';
import { isNotBlankString, isNotEmptyArray, stdoutErrorEvent } from './helpers';
import fs from 'fs';
import { LogLevel } from './types';

/**
 * @param {string} level 'INFO' | 'ERROR' | 'WARN' | 'FATAL' | 'DEBUG' | 'TRACE' | string
 */
const attachLog = (message: string, level: LogLevel = 'INFO') => {
  if (isNotBlankString(message) && isNotBlankString(level)) {
    process.stdout.write(
      JSON.stringify({
        eventType: EVENT_NAMES.ATTACH_TEST_LOG,
        payload: { message, level },
      }),
    );
  } else {
    stdoutErrorEvent(
      'currentTest.log',
      `Message and level parameters must not be a blank string, provided parameters are '${message}' and '${level}'.`,
    );
  }
};

export const currentTest = {
  setMaintainer: (maintainer: string): void => {
    if (isNotBlankString(maintainer)) {
      process.stdout.write(JSON.stringify({ eventType: EVENT_NAMES.ATTACH_TEST_MAINTAINER, payload: maintainer }));
    } else {
      stdoutErrorEvent(
        'currentTest.setMaintainer',
        `Maintainer must not be a blank string. Provided value is '${maintainer}'`,
      );
    }
  },

  log: {
    info: (message: string) => attachLog(message, 'INFO'),
    error: (message: string) => attachLog(message, 'ERROR'),
    warn: (message: string) => attachLog(message, 'WARN'),
    fatal: (message: string) => attachLog(message, 'FATAL'),
    debug: (message: string) => attachLog(message, 'DEBUG'),
    trace: (message: string) => attachLog(message, 'TRACE'),
    custom: (message: string, level: string) => attachLog(message, level),
  },

  attachLabel: (key: string, ...values: string[]) => {
    if (!isNotBlankString(key)) {
      stdoutErrorEvent('currentTest.attachLabel', `Label key must not be a blank string. Provided value is '${key}'`);
      return;
    }

    if (!isNotEmptyArray(values)) {
      stdoutErrorEvent(
        'currentTest.attachLabel',
        `You must provide at least one label value. The label with the key '${key}' has none`,
      );
      return;
    }

    values = values.filter((value) => {
      const isNotBlank = isNotBlankString(value);
      if (!isNotBlank) {
        stdoutErrorEvent(
          'currentTest.attachLabel',
          `Label value must not be a blank string. Provided value for key '${key}' is '${value}'`,
        );
      }
      return isNotBlank;
    });

    if (isNotEmptyArray(values)) {
      process.stdout.write(JSON.stringify({ eventType: EVENT_NAMES.ATTACH_TEST_LABELS, payload: { key, values } }));
    }
  },

  attachArtifactReference: (name: string, value: string) => {
    if (!isNotBlankString(name)) {
      stdoutErrorEvent(
        'currentTest.attachArtifactReference',
        `Artifact reference name must not be a blank string. Provided value is '${name}'`,
      );
      return;
    }

    if (!isNotBlankString(value)) {
      stdoutErrorEvent(
        'currentTest.attachArtifactReference',
        `Artifact reference value must not be a blank string. Provided value for name '${value}' is '${value}'`,
      );
      return;
    }

    process.stdout.write(
      JSON.stringify({ eventType: EVENT_NAMES.ATTACH_TEST_ARTIFACT_REFERENCES, payload: { name, value } }),
    );
  },

  attachArtifact: (pathOrBuffer: Buffer | string, name?: string) => {
    const timestamp = new Date().getTime();

    if (!Buffer.isBuffer(pathOrBuffer) && !fs.existsSync(pathOrBuffer)) {
      stdoutErrorEvent(
        'currentTest.attachArtifact',
        `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`,
      );
      return;
    }

    if (name && !name.trim().length) {
      stdoutErrorEvent(
        'currentTest.attachArtifact',
        `fileName must not be a blank string. Provided value is '${name}'`,
      );
    }

    process.stdout.write(
      JSON.stringify({
        eventType: EVENT_NAMES.ATTACH_TEST_ARTIFACT,
        payload: { pathOrBuffer, timestamp, name },
      }),
    );
  },

  attachScreenshot: (pathOrBuffer: Buffer | string) => {
    if (!Buffer.isBuffer(pathOrBuffer) && !fs.existsSync(pathOrBuffer)) {
      stdoutErrorEvent(
        'currentTest.attachScreenshot',
        `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`,
      );
      return;
    }

    process.stdout.write(
      JSON.stringify({
        eventType: EVENT_NAMES.ATTACH_TEST_SCREENSHOT,
        payload: { pathOrBuffer },
      }),
    );
  },

  revertRegistration: () => {
    const eventType = EVENT_NAMES.REVERT_TEST_REGISTRATION;
    process.stdout.write(JSON.stringify({ eventType }));
  },
};
