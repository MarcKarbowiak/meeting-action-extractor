export type ExtractedTask = {
  title: string;
  owner?: string;
  dueDate?: string;
  confidence: number;
};

export interface IExtractionProvider {
  extractTasks(rawText: string): ExtractedTask[];
}
