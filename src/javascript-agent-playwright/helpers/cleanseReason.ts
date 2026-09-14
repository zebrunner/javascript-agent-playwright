import { stripTerminalCodes } from './stripTerminalCodes';

export const cleanseReason = (rawReason) => (rawReason ? stripTerminalCodes(rawReason) : '');
