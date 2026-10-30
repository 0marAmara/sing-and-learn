export interface Timing {
  start: number | null;
  end: number | null;
}

export interface TimingConfig {
  table: 2;
  timings: Timing[];
}

export interface SavedScore {
  score: number;
  total: number;
  mode: 'ordered' | 'shuffle';
  playedAt: string;
}
