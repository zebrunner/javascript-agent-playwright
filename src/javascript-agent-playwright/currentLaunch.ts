import { EVENT_NAMES } from './constants/events';
import { stdoutErrorEvent } from './helpers';
import { isNotBlankString, isNotEmptyArray } from './helpers/type-utils';
import fs from 'fs';

export const currentLaunch = {
  attachLabel: (key: string, ...values: string[]) => {
    if (!isNotBlankString(key)) {
      stdoutErrorEvent('currentLaunch.attachLabel', `Label key must be a not blank string. Provided value is '${key}'`);
      return;
    }

    if (!isNotEmptyArray(values)) {
      stdoutErrorEvent(
        'currentLaunch.attachLabel',
        `You must provide at least one label value. The label with the key '${key}' has none`,
      );
      return;
    }

    values = values.filter((value) => {
      const isNotBlank = isNotBlankString(value);
      if (!isNotBlank) {
        stdoutErrorEvent(
          'currentLaunch.attachLabel',
          `Label value must be a not blank string. Provided value for key '${key}' is '${value}'`,
        );
      }
      return isNotBlank;
    });

    if (isNotEmptyArray(values)) {
      process.stdout.write(JSON.stringify({ eventType: EVENT_NAMES.ATTACH_LAUNCH_LABELS, payload: { key, values } }));
    }
  },

  attachArtifactReference: (name: string, value: string) => {
    if (!isNotBlankString(name)) {
      stdoutErrorEvent(
        'currentLaunch.attachArtifactReference',
        `Artifact reference name must be a not blank string. Provided value is '${name}'`,
      );
      return;
    }

    if (!isNotBlankString(value)) {
      stdoutErrorEvent(
        'currentLaunch.attachArtifactReference',
        `Artifact reference value must be a not blank string. Provided value for name '${value}' is '${value}'`,
      );
      return;
    }

    process.stdout.write(
      JSON.stringify({ eventType: EVENT_NAMES.ATTACH_LAUNCH_ARTIFACT_REFERENCES, payload: { name, value } }),
    );
  },

  attachArtifact: (pathOrBuffer: Buffer | string, name?: string) => {
    const timestamp = new Date().getTime();

    if (!Buffer.isBuffer(pathOrBuffer) && !fs.existsSync(pathOrBuffer)) {
      stdoutErrorEvent(
        'currentLaunch.attachArtifact',
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
        eventType: EVENT_NAMES.ATTACH_LAUNCH_ARTIFACT,
        payload: { pathOrBuffer, timestamp, name },
      }),
    );
  },
};
