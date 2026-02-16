import type { Task } from '@meeting-action-extractor/db';

const escapeCsv = (value: string): string => {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
};

const toCell = (value: string | number | undefined): string => {
  if (value === undefined) {
    return '';
  }

  return escapeCsv(String(value));
};

export const tasksToCsv = (tasks: Task[]): string => {
  const header = 'id,title,owner,dueDate,status,confidence,notesId,createdAt';

  const rows = tasks.map((task) => {
    return [
      toCell(task.id),
      toCell(task.title),
      toCell(task.owner),
      toCell(task.dueDate),
      toCell(task.status),
      toCell(task.confidence),
      toCell(task.noteId),
      toCell(task.createdAt),
    ].join(',');
  });

  return `${[header, ...rows].join('\n')}\n`;
};
