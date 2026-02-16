import { describe, expect, it } from 'vitest';

import { RulesExtractionProvider } from '../src/rules-extraction-provider.js';

describe('RulesExtractionProvider', () => {
  it('extracts keyword tasks with owner and due date confidence boost', () => {
    const provider = new RulesExtractionProvider();

    const tasks = provider.extractTasks(`
ACTION: Finalize release notes Owner: Priya due 2026-03-01
TODO: Send budget draft @Alex 2026-03-05
    `);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      title: 'Finalize release notes',
      owner: 'Priya',
      dueDate: '2026-03-01',
      confidence: 0.8,
    });
    expect(tasks[1]).toMatchObject({
      title: 'Send budget draft',
      owner: 'Alex',
      dueDate: '2026-03-05',
      confidence: 0.8,
    });
  });

  it('extracts heuristic bullets with lower confidence', () => {
    const provider = new RulesExtractionProvider();

    const tasks = provider.extractTasks(`
- review legal changes with counsel
* schedule demo follow-up
* FYI updates only
    `);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      title: 'review legal changes with counsel',
      confidence: 0.4,
    });
    expect(tasks[1]).toMatchObject({
      title: 'schedule demo follow-up',
      confidence: 0.4,
    });
  });

  it('ignores non-task lines and normalizes values', () => {
    const provider = new RulesExtractionProvider();

    const tasks = provider.extractTasks(`
Random discussion line
FOLLOW UP:   Coordinate with @Mina   due 2026-04-10
- informational bullet only
    `);

    expect(tasks).toEqual([
      {
        title: 'Coordinate with',
        owner: 'Mina',
        dueDate: '2026-04-10',
        confidence: 0.8,
      },
    ]);
  });
});
