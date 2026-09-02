import { isProviderSessionLabel } from '../constants/labels';

type Label = { key: string; value: string };

export const normalizeAttemptLabels = (labels: Label[], attempt: number): Label[] => {
  const ordinary: Label[] = [];
  const ordinaryKeys = new Set<string>();

  for (const label of labels) {
    if (
      isProviderSessionLabel(label.key) ||
      label.key === 'retries' ||
      label.key === 'attempt' ||
      /^attempt\.\d+\.(sessionId|first-session-id)$/.test(label.key)
    ) {
      continue;
    }
    const key = `${label.key}\u0000${label.value}`;
    if (ordinaryKeys.has(key)) continue;
    ordinaryKeys.add(key);
    ordinary.push(label);
  }

  const normalized = [...ordinary];
  if (attempt > 0) normalized.push({ key: 'retries', value: String(attempt) });
  return normalized;
};
