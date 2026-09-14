import * as path from 'path';
import { Suite } from '@playwright/test/reporter';
import { ExtendedPwTestCase } from '../types';

/**
 * Identity of a test as Zebrunner stores it alongside the test record. On a rerun the agent
 * receives the correlation data of the tests to run back from the backend and uses it to
 * re-attach each executed test to the record it had in the original launch.
 *
 * The shape mirrors the WebdriverIO agent's correlation data: what identifies the test, never
 * what it ran on. The reported test name is a display value and changes with naming conventions;
 * correlation data must stay stable across agent versions.
 */
export class CorrelationData {
  readonly projectName: string;
  readonly spec: string;
  readonly titlePath: string[];

  constructor(projectName: string, spec: string, titlePath: string[]) {
    this.projectName = projectName;
    this.spec = spec;
    this.titlePath = titlePath;
  }

  stringify(): string {
    return JSON.stringify({ projectName: this.projectName, spec: this.spec, titlePath: this.titlePath });
  }

  /**
   * Value the correlation data is keyed by. Derived from the parsed fields rather than the stored
   * string, so a record written by a different agent version still matches as long as it carries
   * the same identity.
   */
  key(): string {
    return JSON.stringify([this.projectName, this.spec, this.titlePath]);
  }

  /** Returns `undefined` for anything that is not identity correlation data, including the legacy browser/os payload. */
  static parse(value: string): CorrelationData | undefined {
    if (!value) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed.spec !== 'string' || !Array.isArray(parsed.titlePath)) {
        return undefined;
      }
      return new CorrelationData(
        typeof parsed.projectName === 'string' ? parsed.projectName : '',
        parsed.spec,
        parsed.titlePath.map(String),
      );
    } catch {
      return undefined;
    }
  }
}

/** Makes the spec path stable across machines and reruns, the same way the WebdriverIO agent does. */
const normalizeSpec = (spec: string): string => {
  if (!spec) {
    return '';
  }
  const normalized = path.normalize(spec);
  const workingDirectory = process.cwd();
  const relative = normalized.startsWith(workingDirectory)
    ? normalized.slice(workingDirectory.length + 1)
    : normalized;
  return relative.split(path.sep).join('/');
};

export const buildCorrelationData = (pwTest: ExtendedPwTestCase): CorrelationData => {
  const projectName = pwTest._projectId || pwTest.parent?.project()?.name || '';
  const titlePath: string[] = [];
  let suite: Suite | undefined = pwTest.parent;

  // Only describe titles: the project and the file are carried by their own fields.
  while (suite) {
    const suiteType = (suite as Suite & { type?: string }).type;
    if (suite.title && suiteType !== 'project' && suiteType !== 'file') {
      titlePath.unshift(suite.title);
    }
    suite = suite.parent;
  }
  titlePath.push(pwTest.title);

  return new CorrelationData(projectName, normalizeSpec(pwTest.location?.file), titlePath);
};
