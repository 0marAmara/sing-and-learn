export interface Timing {
  start: number | null;
  end: number | null;
}

export interface TimingConfig {
  tables: TableConfig[];
  videos?: VideoLink[];
}

export interface TableConfig {
  table: number;
  audio: string | null;
  timings: Timing[];
}

export interface VideoLink {
  table: number;
  title: string;
  url: string;
  thumbnail: string;
}

export interface SavedScore {
  score: number;
  total: number;
  mode: 'ordered' | 'shuffle';
  table: number;
  playedAt: string;
}
