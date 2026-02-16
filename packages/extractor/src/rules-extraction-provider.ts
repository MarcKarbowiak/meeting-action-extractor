import type { ExtractedTask, IExtractionProvider } from './types.js';

const KEYWORDS = ['ACTION:', 'TODO:', 'NEXT:', 'FOLLOW UP:'];
const DATE_PATTERN = /(\d{4}-\d{2}-\d{2})/;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const stripLeadingBullet = (value: string): string => value.replace(/^[-*]\s*/, '').trim();

const hasVerbHeuristic = (value: string): boolean => {
  const lowered = value.toLowerCase();
  const verbs = [
    'follow',
    'send',
    'review',
    'prepare',
    'draft',
    'update',
    'create',
    'confirm',
    'schedule',
    'share',
    'complete',
    'finalize',
    'publish',
    'call',
    'email',
    'reach',
    'align',
  ];

  return verbs.some((verb) => lowered.startsWith(`${verb} `) || lowered.includes(` ${verb} `));
};

const parseOwner = (value: string): string | undefined => {
  const atMatch = value.match(/@([A-Za-z][A-Za-z\-]*)/);
  if (atMatch?.[1]) {
    return normalizeWhitespace(atMatch[1]);
  }

  const ownerMatch = value.match(
    /Owner:\s*([A-Za-z][A-Za-z\- ]*?)(?=\s+due\b|\s+\d{4}-\d{2}-\d{2}\b|$)/i,
  );
  if (!ownerMatch?.[1]) {
    return undefined;
  }

  return normalizeWhitespace(ownerMatch[1]);
};

const parseDueDate = (value: string): string | undefined => {
  const dueMatch = value.match(/due\s+(\d{4}-\d{2}-\d{2})/i);
  if (dueMatch) {
    return dueMatch[1];
  }

  const dateMatch = value.match(DATE_PATTERN);
  return dateMatch?.[1];
};

const cleanTitle = (value: string): string => {
  return normalizeWhitespace(
    value
      .replace(/Owner:\s*[A-Za-z][A-Za-z\- ]*/gi, '')
      .replace(/@([A-Za-z][A-Za-z\- ]*)/g, '')
      .replace(/due\s+\d{4}-\d{2}-\d{2}/gi, '')
      .replace(DATE_PATTERN, '')
      .replace(/\(\s*\)/g, ''),
  );
};

const toTask = (source: string, baseConfidence: number): ExtractedTask | undefined => {
  const owner = parseOwner(source);
  const dueDate = parseDueDate(source);
  const title = cleanTitle(source);

  if (title.length === 0) {
    return undefined;
  }

  const confidence = owner && dueDate ? 0.8 : baseConfidence;

  return {
    title,
    owner,
    dueDate,
    confidence,
  };
};

export class RulesExtractionProvider implements IExtractionProvider {
  public extractTasks(rawText: string): ExtractedTask[] {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const results: ExtractedTask[] = [];

    for (const line of lines) {
      const keyword = KEYWORDS.find((prefix) => line.toUpperCase().startsWith(prefix));
      if (keyword) {
        const content = normalizeWhitespace(line.slice(keyword.length));
        const task = toTask(content, 0.6);
        if (task) {
          results.push(task);
        }

        continue;
      }

      if (line.startsWith('-') || line.startsWith('*')) {
        const bulletContent = stripLeadingBullet(line);
        if (!hasVerbHeuristic(bulletContent)) {
          continue;
        }

        const task = toTask(bulletContent, 0.4);
        if (task) {
          results.push(task);
        }
      }
    }

    return results;
  }
}
