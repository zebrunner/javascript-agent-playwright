import { EVENT_NAMES } from './constants/events';
import { isNotBlankString, isNotEmptyArray, stdoutErrorEvent } from './helpers';
import fs from 'fs';
import { LogLevel } from './types';

export const CurrentTest = {
  setMaintainer: (maintainer: string): void => {
    if (isNotBlankString(maintainer)) {
      process.stdout.write(JSON.stringify({ eventType: EVENT_NAMES.ATTACH_TEST_MAINTAINER, payload: maintainer }));
    } else {
      stdoutErrorEvent(
        'CurrentTest.setMaintainer',
        `Maintainer must not be a blank string. Provided value is '${maintainer}'`,
      );
    }
  },

  /**
   * @param {string} level 'INFO' | 'ERROR' | 'WARN' | 'FATAL' | 'DEBUG' | 'TRACE' | string
   */
  addLog: (message: string, level: LogLevel = 'INFO'): void => {
    const timestamp = new Date().getTime();

    if (isNotBlankString(message) && isNotBlankString(level)) {
      process.stdout.write(
        JSON.stringify({
          eventType: EVENT_NAMES.ATTACH_TEST_LOG,
          payload: { message, timestamp, level },
        }),
      );
    } else {
      stdoutErrorEvent(
        'CurrentTest.addLog',
        `Message and level parameters must not be a blank string, provided parameters are '${message}' and '${level}'.`,
      );
    }
  },

  attachLabel: (key: string, ...values: string[]) => {
    if (!isNotBlankString(key)) {
      stdoutErrorEvent('CurrentTest.attachLabel', `Label key must not be a blank string. Provided value is '${key}'`);
      return;
    }

    if (!isNotEmptyArray(values)) {
      stdoutErrorEvent(
        'CurrentTest.attachLabel',
        `You must provide at least one label value. The label with the key '${key}' has none`,
      );
      return;
    }

    values = values.filter((value) => {
      const isNotBlank = isNotBlankString(value);
      if (!isNotBlank) {
        stdoutErrorEvent(
          'CurrentTest.attachLabel',
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
        'CurrentTest.attachArtifactReference',
        `Artifact reference name must not be a blank string. Provided value is '${name}'`,
      );
      return;
    }

    if (!isNotBlankString(value)) {
      stdoutErrorEvent(
        'CurrentTest.attachArtifactReference',
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
        'CurrentTest.attachArtifact',
        `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`,
      );
      return;
    }

    if (name && !name.trim().length) {
      stdoutErrorEvent(
        'CurrentTest.attachArtifact',
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
    const timestamp = new Date().getTime();

    if (!Buffer.isBuffer(pathOrBuffer) && !fs.existsSync(pathOrBuffer)) {
      stdoutErrorEvent(
        'CurrentTest.attachScreenshot',
        `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`,
      );
      return;
    }

    process.stdout.write(
      JSON.stringify({
        eventType: EVENT_NAMES.ATTACH_TEST_SCREENSHOT,
        payload: { pathOrBuffer, timestamp },
      }),
    );
  },

  revertRegistration: () => {
    const eventType = EVENT_NAMES.REVERT_TEST_REGISTRATION;
    process.stdout.write(JSON.stringify({ eventType }));
  },
};
