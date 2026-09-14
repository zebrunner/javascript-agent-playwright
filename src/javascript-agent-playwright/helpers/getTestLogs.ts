import * as path from 'path';
import * as fs from 'fs';
import { StructuredAction, TestLog, TestLogOptions } from '../types';
import { formatFailureReason } from './formatFailureReason';
import { sanitizeLogMessage } from './sanitizeTelemetry';

type StepLocation = {
  file?: string;
  line?: number;
  column?: number;
};

type ReporterStep = {
  title: string;
  category?: string;
  startTime: Date;
  duration?: number;
  location?: StepLocation;
  error?: { message?: string; stack?: string };
  steps?: ReporterStep[];
  screenshotPathOrBuffer?: string | Buffer;
  deleteAfterUpload?: boolean;
};

type TimeRange = {
  startedAt: number;
  endedAt: number;
};

const isHookStep = (step: ReporterStep): boolean =>
  step.category === 'hook' || /^(Before|After) Hooks$/i.test(step.title);

const isFixtureStep = (step: ReporterStep): boolean =>
  step.category === 'fixture' || /^Fixture "/i.test(step.title);

const excludesStepTree = (step: ReporterStep, options: TestLogOptions): boolean =>
  (!options.includeHooks && isHookStep(step)) ||
  (!options.includeFixtures && isFixtureStep(step));

const collectExcludedRanges = (
  steps: ReporterStep[] | undefined,
  options: TestLogOptions,
  ranges: TimeRange[] = [],
): TimeRange[] => {
  for (const step of steps || []) {
    if (!options.includeHooks && isHookStep(step)) {
      const startedAt = step.startTime.getTime();
      ranges.push({
        startedAt,
        endedAt: startedAt + (step.duration || 0),
      });
    } else {
      collectExcludedRanges(step.steps, options, ranges);
    }
  }
  return ranges;
};

const isInternalLocation = (location: StepLocation | undefined): boolean =>
  !!location?.file && (/[\\/]node_modules[\\/]/.test(location.file) || location.file.startsWith('node:'));

const stripLineComment = (line: string): string => {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\' && (inSingle || inDouble || inTemplate)) {
      escaped = true;
      continue;
    }
    if (character === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
    else if (character === '"' && !inSingle && !inTemplate) inDouble = !inDouble;
    else if (character === '`' && !inSingle && !inDouble) inTemplate = !inTemplate;
    else if (
      character === '/' &&
      next === '/' &&
      !inSingle &&
      !inDouble &&
      !inTemplate &&
      (index === 0 || line[index - 1] !== '\\')
    ) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line;
};

const netBalance = (line: string): number =>
  (line.match(/[([{]/g) || []).length - (line.match(/[)\]}]/g) || []).length;

const isContinuationLine = (line: string): boolean => /^[)\]}.,]/.test(line);

const expandSnippetStart = (lines: string[], locationIndex: number, maxSourceLines: number): number => {
  let start = locationIndex;
  let taken = 1;
  let acc = netBalance(stripLineComment(lines[start] || '').trim());
  while (start > 0 && taken < maxSourceLines) {
    const current = stripLineComment(lines[start] || '').trim();
    if (!current) {
      start -= 1;
      continue;
    }
    if (!isContinuationLine(current) && acc >= 0) break;
    let previous = start - 1;
    while (previous > 0 && !stripLineComment(lines[previous] || '').trim()) previous -= 1;
    start = previous;
    taken += 1;
    acc += netBalance(stripLineComment(lines[start] || '').trim());
  }
  while (start < locationIndex && !stripLineComment(lines[start] || '').trim()) start += 1;
  return start;
};

const readSourceSnippet = (
  location: StepLocation | undefined,
  maxSourceLines: number,
  sourceCache: Map<string, string[]>,
): string => {
  if (!location?.file || !location?.line || maxSourceLines < 1 || isInternalLocation(location)) return '';
  try {
    let lines = sourceCache.get(location.file);
    if (!lines) {
      lines = fs.readFileSync(location.file, 'utf-8').split(/\r?\n/);
      sourceCache.set(location.file, lines);
    }
    const locationIndex = location.line - 1;
    if (locationIndex < 0 || locationIndex >= lines.length) return '';
    const selected: string[] = [];
    let balance = 0;
    for (
      let index = expandSnippetStart(lines, locationIndex, maxSourceLines);
      index < lines.length && selected.length < maxSourceLines;
      index += 1
    ) {
      const line = stripLineComment(lines[index]).trim();
      if (!line) continue;
      selected.push(line);
      balance += netBalance(line);
      if (index >= locationIndex && balance <= 0) {
        let next = index + 1;
        while (next < lines.length && !stripLineComment(lines[next] || '').trim()) next += 1;
        const nextLine = stripLineComment(lines[next] || '').trim();
        if (selected.length >= maxSourceLines || !/^\./.test(nextLine)) break;
      }
    }
    return selected.join(' ');
  } catch {
    return '';
  }
};

const formatLocation = (location: StepLocation | undefined): string => {
  if (!location?.file || isInternalLocation(location)) return '';
  const relative = path.relative(process.cwd(), location.file);
  const file = relative && !relative.startsWith('..') ? relative : location.file;
  return `${file}:${location.line || 1}${location.column ? `:${location.column}` : ''}`;
};

const humanizeMatcher = (matcher: string): string =>
  matcher
    .replace(/^not\./, 'not ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

const cleanSchemaPlaceholders = (title: string): string =>
  title
    .replace(/\s*"\{[^{}|]+(?:\|[^{}|]+)+\}"/g, '')
    .replace(/\s*\{[^{}|]+(?:\|[^{}|]+)+\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const extractBalancedArgs = (source: string, openIndex: number): string | null => {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  let balance = 1;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\' && (inSingle || inDouble || inTemplate)) {
      escaped = true;
      continue;
    }
    if (character === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
    else if (character === '"' && !inSingle && !inTemplate) inDouble = !inDouble;
    else if (character === '`' && !inSingle && !inDouble) inTemplate = !inTemplate;
    else if (!inSingle && !inDouble && !inTemplate) {
      if (character === '(') balance += 1;
      else if (character === ')') {
        balance -= 1;
        if (balance === 0) return source.slice(openIndex, index).trim();
      }
    }
  }
  return null;
};

const lastMatcherCall = (source: string): { matcher: string; args: string } | null => {
  const matcherRe = /\.(not\.to[A-Z]\w*|to[A-Z]\w*)\(/g;
  const matches = [...source.matchAll(matcherRe)];
  const last = matches[matches.length - 1];
  if (!last || last.index === undefined) return null;
  const args = extractBalancedArgs(source, last.index + last[0].length);
  if (args === null) return null;
  return { matcher: last[1], args };
};

const splitTopLevelArgs = (args: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < args.length; index += 1) {
    const character = args[index];
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === '\\' && (inSingle || inDouble || inTemplate)) {
      current += character;
      escaped = true;
      continue;
    }
    if (character === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
    else if (character === '"' && !inSingle && !inTemplate) inDouble = !inDouble;
    else if (character === '`' && !inSingle && !inDouble) inTemplate = !inTemplate;
    else if (!inSingle && !inDouble && !inTemplate) {
      if (character === '(' || character === '{' || character === '[') depth += 1;
      else if (character === ')' || character === '}' || character === ']') depth -= 1;
      else if (character === ',' && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const isRuntimeIdentifier = (value: string): boolean =>
  /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value) &&
  !/^(true|false|null|undefined|NaN|Infinity)$/.test(value);

const keepsConstructorArg = (matcher: string): boolean =>
  /^(?:not\.)?(?:toBeInstanceOf|toThrow)$/.test(matcher);

const formatExpectedArgs = (args: string, matcher: string): string => {
  const parts = splitTopLevelArgs(args);
  if (!parts.length) return '';
  const kept =
    !keepsConstructorArg(matcher) && isRuntimeIdentifier(parts[0]) ? parts.slice(1) : parts;
  return kept.join(', ');
};

const humanizeQuotedExpectTitle = (title: string): string => {
  const match = title.match(/^Expect "((?:not\.)?to[A-Z]\w+)"\s*(.*)$/);
  if (!match) return title;
  const expectation = humanizeMatcher(match[1]);
  const rest = match[2].trim();
  const target = rest.match(/^((?:locator|getBy\w+)\(.+\))$/)?.[1];
  if (target) return `Expect ${target} ${expectation}`;
  return rest ? `Expect ${expectation} ${rest}` : `Expect ${expectation}`;
};

const expectTarget = (title: string, source: string): string | undefined => {
  const fromTitle = title.match(/((?:locator|getBy\w+)\(.+\))$/)?.[1];
  if (fromTitle) return fromTitle;
  const match = source.match(/\bexpect(?:\.(?:soft|poll))*\(/);
  if (!match || match.index === undefined) return undefined;
  const args = extractBalancedArgs(source, match.index + match[0].length);
  if (args === null) return undefined;
  const first = splitTopLevelArgs(args)[0];
  if (!first || /\basync\b/.test(first) || first.includes('=>')) return undefined;
  return first;
};

const formatExpectTitle = (step: ReporterStep, source: string): string => {
  const title = cleanSchemaPlaceholders(step.title) || step.title;
  if (step.category !== 'expect') return title;
  if (!source) return humanizeQuotedExpectTitle(title);
  const call = lastMatcherCall(source);
  if (!call) return humanizeQuotedExpectTitle(title);
  const target = expectTarget(title, source);
  const expectation = humanizeMatcher(call.matcher);
  const expected = formatExpectedArgs(call.args, call.matcher);
  const detail = `${expectation}${expected ? ` ${expected}` : ''}`;
  return target ? `Expect ${target} ${detail}` : `Expect ${detail}`;
};

const isAbsoluteUrl = (value: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(value);

const unescapeStringLiteral = (value: string): string =>
  value.replace(/\\([\\'"nrt])/g, (_, character: string) => {
    if (character === 'n') return '\n';
    if (character === 'r') return '\r';
    if (character === 't') return '\t';
    return character;
  });

const interpolateTemplate = (body: string, bindings: Map<string, string>): string | undefined => {
  let output = '';
  for (let index = 0; index < body.length; ) {
    if (body.startsWith('${', index)) {
      const end = body.indexOf('}', index + 2);
      if (end < 0) return undefined;
      const name = body.slice(index + 2, end).trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(name) || !bindings.has(name)) return undefined;
      output += bindings.get(name);
      index = end + 1;
      continue;
    }
    output += body[index];
    index += 1;
  }
  return output;
};

const parseStaticString = (raw: string, bindings: Map<string, string>): string | undefined => {
  const quoted = raw.match(/^(['"])((?:\\.|[^\\])*?)\1$/);
  if (quoted) return unescapeStringLiteral(quoted[2]);
  const template = raw.match(/^`([\s\S]*)`$/);
  if (!template) return undefined;
  return interpolateTemplate(template[1], bindings);
};

const collectStringBindings = (lines: string[] | undefined): Map<string, string> => {
  const bindings = new Map<string, string>();
  if (!lines?.length) return bindings;
  const assignment = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?)\s*;?\s*$/;
  for (let pass = 0; pass < 4; pass += 1) {
    let added = false;
    for (const line of lines) {
      const match = stripLineComment(line).trim().match(assignment);
      if (!match || bindings.has(match[1])) continue;
      const value = parseStaticString(match[2], bindings);
      if (value === undefined) continue;
      bindings.set(match[1], value);
      added = true;
    }
    if (!added) break;
  }
  return bindings;
};

const resolveStaticString = (expr: string, bindings: Map<string, string>): string | undefined => {
  const trimmed = expr.trim();
  const fromLiteral = parseStaticString(trimmed, bindings);
  if (fromLiteral !== undefined) return fromLiteral;
  if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) return bindings.get(trimmed);
  return undefined;
};

const extractUrlArgument = (
  source: string,
  bindings: Map<string, string>,
  methods: string[],
): string | undefined => {
  if (!source || !methods.length) return undefined;
  const callRe = new RegExp(`\\b(?:${methods.join('|')})\\(\\s*`);
  const call = callRe.exec(source);
  if (!call || call.index === undefined) return undefined;
  const args = extractBalancedArgs(source, call.index + call[0].length);
  if (args === null) return undefined;
  const first = splitTopLevelArgs(args)[0];
  if (!first) return undefined;
  return resolveStaticString(first, bindings)?.trim();
};

const httpTitleMethods: Record<string, string[]> = {
  GET: ['get', 'fetch'],
  POST: ['post', 'fetch'],
  PUT: ['put', 'fetch'],
  PATCH: ['patch', 'fetch'],
  DELETE: ['delete', 'fetch'],
  HEAD: ['head', 'fetch'],
  OPTIONS: ['fetch'],
  FETCH: ['fetch', 'get'],
};

const sameSourceLine = (step: ReporterStep, action: StructuredAction): boolean => {
  const stepLine = step.location?.line;
  const actionLine = action.source?.line;
  if (!step.location?.file || !action.source?.file || stepLine == null || actionLine == null) return false;
  if (stepLine !== actionLine) return false;
  return path.normalize(step.location.file) === path.normalize(action.source.file);
};

const gotoUrlForStep = (step: ReporterStep, actions: StructuredAction[]): string | undefined => {
  const startedAt = new Date(step.startTime).getTime();
  const ranked = actions
    .filter((action) => action.method === 'page.goto')
    .map((action) => {
      const params =
        action.params && typeof action.params === 'object' && !Array.isArray(action.params)
          ? (action.params as Record<string, unknown>)
          : {};
      const url = typeof params.url === 'string' ? params.url : undefined;
      if (!url) return undefined;
      return {
        url,
        sameLine: sameSourceLine(step, action),
        delta: Math.abs(action.startedAt - startedAt),
      };
    })
    .filter((entry): entry is { url: string; sameLine: boolean; delta: number } => !!entry)
    .sort((left, right) => Number(right.sameLine) - Number(left.sameLine) || left.delta - right.delta);
  if (!ranked.length) return undefined;
  if (ranked[0].sameLine) return ranked[0].url;
  return ranked.length === 1 ? ranked[0].url : undefined;
};

const rewriteLossyUrlTitle = (
  title: string,
  source: string,
  bindings: Map<string, string>,
  actionUrl?: string,
): string => {
  const navigate = title.match(/^(Navigate to )"([^"]*)"(.*)$/i);
  if (navigate) {
    if (isAbsoluteUrl(navigate[2])) return title;
    const url = (actionUrl || extractUrlArgument(source, bindings, ['goto']) || '').trim();
    if (!url || url === navigate[2]) return title;
    return `${navigate[1]}"${url}"${navigate[3]}`;
  }
  const http = title.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|FETCH) "([^"]*)"(.*)$/i);
  if (!http) return title;
  if (isAbsoluteUrl(http[2])) return title;
  const methods = httpTitleMethods[http[1].toUpperCase()] || [http[1].toLowerCase()];
  const url = (extractUrlArgument(source, bindings, methods) || '').trim();
  if (!url || url === http[2] || !isAbsoluteUrl(url)) return title;
  return `${http[1].toUpperCase()} "${url}"${http[3]}`;
};

const extractSelectorTextValue = (
  selector: string,
  bindings: Map<string, string>,
): string | undefined => {
  const explicit = selector.match(/\btext\s*:\s*([^,}]+)/);
  if (!explicit) return undefined;
  return resolveStaticString(explicit[1].trim(), bindings);
};

const rewriteBareDeviceTitle = (
  title: string,
  source: string,
  bindings: Map<string, string>,
): string => {
  const kind = title.match(/^(Wait|Tap)$/i);
  if (!kind) return title;
  const verb = `${kind[1].charAt(0).toUpperCase()}${kind[1].slice(1).toLowerCase()}`;
  const call = source.match(/\.(?:wait|tap)\(\s*/);
  if (!call || call.index === undefined) return title;
  const args = extractBalancedArgs(source, call.index + call[0].length);
  if (args === null) return title;
  const selector = splitTopLevelArgs(args)[0];
  if (!selector || !selector.startsWith('{')) return title;
  const textValue = extractSelectorTextValue(selector, bindings);
  if (textValue) return verb === 'Wait' ? `Wait for "${textValue}"` : `Tap "${textValue}"`;
  if (/\btext\b/.test(selector)) return verb === 'Wait' ? 'Wait for text' : 'Tap text';
  return title;
};

const formatStep = (
  step: ReporterStep,
  depth: number,
  options: TestLogOptions,
  sourceCache: Map<string, string[]>,
  actions: StructuredAction[] = [],
): string => {
  const indent = '  '.repeat(depth);
  const source = readSourceSnippet(step.location, options.maxSourceLines, sourceCache);
  const fileLines = step.location?.file ? sourceCache.get(step.location.file) : undefined;
  const bindings = collectStringBindings(fileLines);
  const stepTitle = rewriteBareDeviceTitle(
    rewriteLossyUrlTitle(
      cleanSchemaPlaceholders(step.title) || step.title,
      source,
      bindings,
      gotoUrlForStep(step, actions),
    ),
    source,
    bindings,
  );
  const titledStep = stepTitle === step.title ? step : { ...step, title: stepTitle };
  if (options.format === 'source-line') {
    const message = `${indent}${source || stepTitle}`;
    return step.error ? `${message}\n${indent}error: ${formatFailureReason(step.error)}` : message;
  }
  if (options.format === 'playwright-title') {
    const message = `${indent}${formatExpectTitle(titledStep, source)}`;
    return step.error ? `${message}\n${indent}error: ${formatFailureReason(step.error)}` : message;
  }

  const metadata: string[] = [];
  if (options.includeDuration && Number.isFinite(step.duration)) metadata.push(`${step.duration}ms`);
  const title = formatExpectTitle(titledStep, source);
  const suffix = metadata.length ? ` [${metadata.join(', ')}]` : '';
  const lines = [`${indent}${title}${suffix}`];
  if (source && source !== title) lines.push(`${indent}  source: ${source}`);
  if (options.includeLocation) {
    const location = formatLocation(step.location);
    if (location) lines.push(`${indent}  at: ${location}`);
  }
  if (step.error) lines.push(`${indent}  error: ${formatFailureReason(step.error)}`);
  return lines.join('\n');
};

const actionTitleAliases: Record<string, RegExp> = {
  'page.goto': /^navigate to\b/i,
  'page.reload': /^reload\b/i,
  'page.goBack': /^go back\b/i,
  'page.goForward': /^go forward\b/i,
};

const actionAlias = (action: StructuredAction): RegExp | undefined => {
  if (action.kind === 'playwright') return actionTitleAliases[action.method];
  if (action.kind === 'bridge') return /^evaluate\b/i;
  if (action.kind === 'fixture' && action.method === 'fixture.page.create') return /^(create|new) page\b/i;
  if (action.kind !== 'appium') return undefined;
  const method = action.method.split('.').pop();
  const aliases: Record<string, RegExp> = {
    click: /^click\b/i,
    dblclick: /^double click\b/i,
    tap: /^tap\b/i,
    fill: /^fill\b/i,
    type: /^type\b/i,
    press: /^press\b/i,
    check: /^check\b/i,
    uncheck: /^uncheck\b/i,
    setChecked: /^set checked\b/i,
    hover: /^hover\b/i,
  };
  return method ? aliases[method] : undefined;
};

const flattenSteps = (
  steps: ReporterStep[] | undefined,
  output: ReporterStep[] = [],
): ReporterStep[] => {
  for (const step of steps || []) {
    output.push(step);
    flattenSteps(step.steps, output);
  }
  return output;
};

const selectSuppressedSteps = (
  steps: ReporterStep[] | undefined,
  actions: StructuredAction[],
): Set<ReporterStep> => {
  const candidates = flattenSteps(steps).filter((step) => step.category === 'pw:api');
  const suppressed = new Set<ReporterStep>();
  for (const action of actions) {
    const { endedAt } = action;
    if (typeof endedAt !== 'number' || !Number.isFinite(endedAt)) continue;
    const inActionWindow = (step: ReporterStep): boolean => {
      const startedAt = new Date(step.startTime).getTime();
      return startedAt >= action.startedAt && startedAt <= endedAt + 100;
    };
    const alias = actionAlias(action);
    if (alias) {
      const match = candidates
        .filter((step) => !suppressed.has(step) && alias.test(step.title) && inActionWindow(step))
        .sort(
          (left, right) =>
            Math.abs(new Date(left.startTime).getTime() - action.startedAt) -
            Math.abs(new Date(right.startTime).getTime() - action.startedAt),
        )[0];
      if (match) suppressed.add(match);
    }
    if (action.kind !== 'bridge') continue;
    for (const step of candidates) {
      if (suppressed.has(step) || !sameSourceLine(step, action) || !inActionWindow(step)) continue;
      suppressed.add(step);
    }
  }
  return suppressed;
};

const actionTitle = (action: StructuredAction): string => {
  const params =
    action.params && typeof action.params === 'object' && !Array.isArray(action.params)
      ? (action.params as Record<string, unknown>)
      : {};
  if (action.method === 'page.goto') {
    return typeof params.url === 'string' ? `Navigate to "${params.url}"` : 'Navigate';
  }
  if (action.method === 'page.reload') return 'Reload page';
  if (action.method === 'page.goBack') return 'Go back';
  if (action.method === 'page.goForward') return 'Go forward';
  return action.method;
};

const actionLog = (action: StructuredAction, zbrTestId: number, options: TestLogOptions): TestLog => {
  const endedAt = action.endedAt ?? action.startedAt;
  const title = actionTitle(action);
  const summary =
    action.status !== 'started' && options.includeDuration
      ? `${Math.max(0, endedAt - action.startedAt)}ms`
      : '';
  const lines =
    options.format === 'structured' && summary ? [`${title} [${summary}]`] : [title];
  if (options.format === 'structured') {
    if (action.params !== undefined) lines.push(`  params: ${JSON.stringify(action.params)}`);
    if (action.source?.file && options.includeLocation) {
      lines.push(`  at: ${formatLocation(action.source)}`);
    }
  }
  if (action.error) lines.push(`  error: ${action.error}`);
  return {
    timestamp: action.startedAt,
    message: sanitizeLogMessage(lines.join('\n'), options.maxMessageLength),
    level: action.status === 'failed' ? 'ERROR' : action.status === 'started' ? 'WARN' : 'INFO',
    testId: zbrTestId,
    type: 'log',
  };
};

// Depth still counts a pending step, so its children render identically here and in the final upload.
const isPendingStep = (step: ReporterStep, options: TestLogOptions): boolean =>
  !!options.onlyCompletedSteps && !(Number.isFinite(step.duration) && step.duration >= 0);

const collectPendingStepTimestamps = (
  steps: ReporterStep[] | undefined,
  options: TestLogOptions,
  timestamps: number[] = [],
): number[] => {
  for (const step of steps || []) {
    if (excludesStepTree(step, options)) continue;
    if (isPendingStep(step, options)) timestamps.push(new Date(step.startTime).getTime());
    collectPendingStepTimestamps(step.steps, options, timestamps);
  }
  return timestamps;
};

const appendSteps = (
  output: TestLog[],
  steps: ReporterStep[] | undefined,
  zbrTestId: number,
  options: TestLogOptions,
  suppressedSteps: Set<ReporterStep>,
  sourceCache: Map<string, string[]>,
  actions: StructuredAction[],
  depth = 0,
): void => {
  for (const step of steps || []) {
    if (excludesStepTree(step, options)) continue;
    const category = step.category || '';
    const include = !(options.ignorePlaywrightSteps && !category.includes('zebrunner'));
    if (include && category === 'zebrunner:screenshot') {
      output.push({
        timestamp: new Date(step.startTime).getTime(),
        testId: zbrTestId,
        type: 'screenshot',
        screenshotPathOrBuffer: step.screenshotPathOrBuffer,
        deleteAfterUpload: step.deleteAfterUpload,
        level: 'INFO',
        message: '',
      });
    } else if (include && !suppressedSteps.has(step) && !isPendingStep(step, options)) {
      const message = sanitizeLogMessage(
        formatStep(step, depth, options, sourceCache, actions),
        options.maxMessageLength,
      );
      let level = 'INFO';
      if (category.includes('zebrunner:log:')) {
        [, , level] = category.split(':');
      } else if (step.error) {
        level = 'ERROR';
      }
      output.push({
        timestamp: new Date(step.startTime).getTime(),
        message,
        level,
        testId: zbrTestId,
        type: 'log',
        isPwTestStep: !category.includes('zebrunner'),
      });
    }
    appendSteps(
      output,
      step.steps,
      zbrTestId,
      options,
      suppressedSteps,
      sourceCache,
      actions,
      depth + (include ? 1 : 0),
    );
  }
};

export const getTestLogs = (
  steps: ReporterStep[],
  zbrTestId: number,
  options: TestLogOptions,
  actions: StructuredAction[] = [],
): TestLog[] => {
  const logs: TestLog[] = [];
  const sourceCache = new Map<string, string[]>();
  const excludedRanges = collectExcludedRanges(steps, options);
  const relevantActions = actions.filter(
    (action) =>
      !excludedRanges.some(
        (range) => action.startedAt >= range.startedAt && action.startedAt <= range.endedAt,
      ),
  );
  const includedActions = relevantActions.filter(
    (action) =>
      !(options.ignorePlaywrightSteps && action.kind === 'playwright') &&
      !(action.kind === 'fixture' && !options.includeFixtures) &&
      !(action.kind === 'bridge' && !options.includeBridgeActions) &&
      !(options.onlyCompletedSteps && action.status === 'started'),
  );
  appendSteps(
    logs,
    steps,
    zbrTestId,
    options,
    selectSuppressedSteps(steps, relevantActions),
    sourceCache,
    relevantActions,
  );
  logs.push(...includedActions.map((action) => actionLog(action, zbrTestId, options)));
  const sortedLogs = logs.sort((left, right) => left.timestamp - right.timestamp);
  if (!options.onlyCompletedSteps) return sortedLogs;

  // A later completed entry must not be uploaded while an older step/action is
  // still running, otherwise periodic flush batches reach the API out of order.
  const pendingTimestamps = collectPendingStepTimestamps(steps, options);
  pendingTimestamps.push(
    ...relevantActions
      .filter((action) => action.status === 'started')
      .map((action) => action.startedAt),
  );
  if (!pendingTimestamps.length) return sortedLogs;
  const chronologicalWatermark = Math.min(...pendingTimestamps);
  return sortedLogs.filter((entry) => entry.timestamp < chronologicalWatermark);
};
