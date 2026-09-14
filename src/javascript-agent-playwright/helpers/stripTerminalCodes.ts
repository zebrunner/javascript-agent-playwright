/* eslint-disable no-control-regex */
const OSC_SEQUENCE = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
const CSI_SEQUENCE = /[\u001b\u009b]\[[0-?]*[ -/]*[@-~]/g;
const ESCAPE_SEQUENCE = /\u001b[@-Z\\-_]/g;
const CARRIAGE_RETURN = /\r\n?/g;
const CONTROL_CHARACTER = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export const stripTerminalCodes = (value: string): string =>
  value
    .replace(OSC_SEQUENCE, '')
    .replace(CSI_SEQUENCE, '')
    .replace(ESCAPE_SEQUENCE, '')
    .replace(CARRIAGE_RETURN, '\n')
    .replace(CONTROL_CHARACTER, '');
