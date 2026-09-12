import { EVENT_NAMES } from './constants/events';
import { isNotBlankString, isNotEmptyArray, stdoutErrorEvent } from './helpers';
import { materializeStdoutArtifact } from './helpers/materializeStdoutArtifact';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { LogLevel, StructuredAction } from './types';
import { sanitizeTelemetryValue } from './helpers/sanitizeTelemetry';

const emitStdoutEvent = (event: { eventType: string; payload?: unknown }) => {
  process.stdout.write(`${JSON.stringify(event)}\n`);
};

/**
 * @param {string} level 'INFO' | 'ERROR' | 'WARN' | 'FATAL' | 'DEBUG' | 'TRACE' | string
 */
const attachLog = (message: string, level: LogLevel = 'INFO') => {
  if (isNotBlankString(message) && isNotBlankString(level)) {
    emitStdoutEvent({
      eventType: EVENT_NAMES.ATTACH_TEST_LOG,
      payload: { message, level, timestamp: Date.now() },
    });
  } else {
    stdoutErrorEvent(
      'currentTest.log',
      `Message and level parameters must not be a blank string, provided parameters are '${message}' and '${level}'.`,
    );
  }
};

export const currentTest = {
  attachAction: (action: Omit<StructuredAction, 'id'> & { id?: string }): void => {
    const validKind = ['playwright', 'bridge', 'appium', 'fixture'].includes(action?.kind);
    const validStatus = action?.status === 'started' || action?.status === 'passed' || action?.status === 'failed';
    const validTimes =
      Number.isFinite(action?.startedAt) &&
      (action.status === 'started' || (Number.isFinite(action?.endedAt) && action.endedAt >= action.startedAt));
    if (!action || !isNotBlankString(action.method) || !validKind || !validStatus || !validTimes) {
      stdoutErrorEvent('currentTest.attachAction', 'Action kind, method, status, and timestamps are invalid.');
      return;
    }

    const payload: StructuredAction = {
      ...action,
      id: action.id || randomUUID(),
      params: sanitizeTelemetryValue(action.params),
      error: action.error ? String(sanitizeTelemetryValue(action.error)) : undefined,
    };
    emitStdoutEvent({ eventType: EVENT_NAMES.ATTACH_TEST_ACTION, payload });
  },

  setMaintainer: (maintainer: string): void => {
    if (isNotBlankString(maintainer)) {
      emitStdoutEvent({ eventType: EVENT_NAMES.ATTACH_TEST_MAINTAINER, payload: maintainer });
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
      emitStdoutEvent({ eventType: EVENT_NAMES.ATTACH_TEST_LABELS, payload: { key, values } });
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

    emitStdoutEvent({ eventType: EVENT_NAMES.ATTACH_TEST_ARTIFACT_REFERENCES, payload: { name, value } });
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

    const artifact = materializeStdoutArtifact(pathOrBuffer, name);
    emitStdoutEvent({
      eventType: EVENT_NAMES.ATTACH_TEST_ARTIFACT,
      payload: { ...artifact, timestamp, name },
    });
  },

  attachVideo: (pathOrBuffer: Buffer | string, name?: string) => {
    if (!Buffer.isBuffer(pathOrBuffer) && !fs.existsSync(pathOrBuffer)) {
      stdoutErrorEvent(
        'currentTest.attachVideo',
        `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`,
      );
      return;
    }

    const artifact = materializeStdoutArtifact(pathOrBuffer, name, '.mp4');
    emitStdoutEvent({
      eventType: EVENT_NAMES.ATTACH_TEST_VIDEO,
      payload: { ...artifact, timestamp: new Date().getTime(), name },
    });
  },

  /** Registers Browser/Platform metadata and an optional provider session id. */
  attachSessionCapabilities: (
    capabilities: {
      browserName?: string;
      browserVersion?: string;
      platformName?: string;
      platformVersion?: string;
      deviceName?: string;
      'zebrunner:provider'?: string;
    },
    sessionId?: string,
  ) => {
    if (!capabilities || typeof capabilities !== 'object') {
      stdoutErrorEvent('currentTest.attachSessionCapabilities', `capabilities must be an object.`);
      return;
    }

    emitStdoutEvent({
      eventType: EVENT_NAMES.ATTACH_TEST_SESSION_CAPABILITIES,
      payload: { capabilities, sessionId },
    });
  },

  attachScreenshot: (pathOrBuffer: Buffer | string) => {
    if (!Buffer.isBuffer(pathOrBuffer) && !fs.existsSync(pathOrBuffer)) {
      stdoutErrorEvent(
        'currentTest.attachScreenshot',
        `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`,
      );
      return;
    }

    const screenshot = materializeStdoutArtifact(pathOrBuffer, undefined, '.png');
    emitStdoutEvent({
      eventType: EVENT_NAMES.ATTACH_TEST_SCREENSHOT,
      payload: { ...screenshot, timestamp: Date.now() },
    });
  },

  revertRegistration: () => {
    const eventType = EVENT_NAMES.REVERT_TEST_REGISTRATION;
    emitStdoutEvent({ eventType });
  },
};
