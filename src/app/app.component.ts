import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import defaultTimingConfig from '../assets/timings.json';
import { SavedScore, TableConfig, Timing, TimingConfig, VideoLink } from './models';

type Screen = 'home' | 'game' | 'complete';
type Mode = 'ordered' | 'shuffle';
type Feedback = 'none' | 'wrong' | 'correct';

const COUNT = 10;
const TABLE_NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9];
const AUDIO_PATHS: Record<number, string | null> = {
  2: 'assets/audio/multiplication-song.mp3',
  3: 'assets/audio/table-3.mp3',
  4: 'assets/audio/table-4.mp3',
  5: 'assets/audio/table-5.mp3',
  6: 'assets/audio/table-6.mp3',
  7: 'assets/audio/table-7.mp3',
  8: 'assets/audio/table-8.mp3',
  9: 'assets/audio/table-9.mp3',
};
const TABLE_NAMES: Record<number, string> = { 2: 'اثنين', 3: 'ثلاثة', 4: 'أربعة', 5: 'خمسة', 6: 'ستة', 7: 'سبعة', 8: 'ثمانية', 9: 'تسعة' };
const CHANNEL_URL = 'https://www.youtube.com/@rehabelzawawy5631';
const SCORES_KEY = 'sing-and-learn.scores.v1';

@Component({
  selector: 'sal-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('song') song?: ElementRef<HTMLAudioElement>;
  @ViewChild('menuButton') menuButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('drawerClose') drawerClose?: ElementRef<HTMLButtonElement>;

  readonly tables = TABLE_NUMBERS;
  readonly questions = Array.from({ length: COUNT }, (_, index) => index + 1);
  readonly tableNames = TABLE_NAMES;
  readonly videos: VideoLink[] = (defaultTimingConfig as TimingConfig).videos ?? [];
  readonly channelUrl = CHANNEL_URL;

  table = 2;
  screen: Screen = 'home';
  mode: Mode = 'ordered';
  menuOpen = false;
  tableConfigs: TableConfig[] = this.emptyConfigs();
  audioDuration = 0;
  gameError = '';
  audioLoading = false;
  isPlayingSegment = false;
  awaitingAnswer = false;
  feedback: Feedback = 'none';
  order: number[] = [];
  questionIndex = 0;
  options: number[] = [];
  wrongOptions = new Set<number>();
  score = 0;
  missed = new Set<number>();
  scores: SavedScore[] = [];
  finalScore = 0;

  private playbackRequest = 0;
  private segmentTimer: number | null = null;
  private advanceTimer: number | null = null;
  private readonly arabicNumberFormatter = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2, useGrouping: false });

  constructor() {
    this.loadTimings();
    this.loadScores();
  }

  ngAfterViewInit(): void {
    const audio = this.song?.nativeElement;
    audio?.addEventListener('loadstart', () => { this.audioLoading = true; });
    audio?.addEventListener('loadedmetadata', () => {
      this.audioDuration = audio.duration;
    });
    audio?.addEventListener('loadeddata', () => { this.audioLoading = false; });
    audio?.addEventListener('error', () => {
      this.audioLoading = false;
      this.isPlayingSegment = false;
      this.awaitingAnswer = false;
      this.gameError = 'تعذّر تحميل الأغنية. اضغط إعادة المحاولة.';
    });
  }

  ngOnDestroy(): void {
    this.stopAudio();
  }

  number(value: number): string {
    return this.arabicNumberFormatter.format(value);
  }

  get tableConfig(): TableConfig {
    return this.tableConfigs.find(config => config.table === this.table) ?? this.emptyConfig(this.table);
  }

  get tableName(): string {
    return this.tableNames[this.table] ?? this.number(this.table);
  }

  tableLabel(table: number): string {
    return `جدول ${this.number(table)} · ${this.tableNames[table] ?? this.number(table)}`;
  }

  get tableAudioUrl(): string {
    return this.tableConfig.audio ?? '';
  }

  get audioSource(): string {
    return this.screen === 'game' ? this.tableAudioUrl : '';
  }

  get activeVideos(): VideoLink[] {
    return this.videos.filter(video => video.table === this.table);
  }

  useLocalThumbnail(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (!image || image.dataset['fallback'] === 'true') return;
    image.dataset['fallback'] = 'true';
    image.src = 'assets/images/sing-and-learn-poster.webp';
  }

  get timingReady(): boolean {
    const config = this.tableConfig;
    return Boolean(config.audio) && config.timings.every((timing, index) => this.validTiming(timing)
      && (index === 0 || (config.timings[index - 1].start ?? 0) <= (timing.start ?? 0)));
  }

  get bestScore(): SavedScore | undefined {
    return this.scores.filter(score => score.table === this.table).slice().sort((a, b) => b.score - a.score)[0];
  }

  get currentFactor(): number {
    return this.order[this.questionIndex] ?? 1;
  }

  get currentAnswer(): number {
    return this.table * this.currentFactor;
  }

  get currentTiming(): Timing {
    return this.tableConfig.timings[this.currentFactor - 1] ?? { start: null, end: null };
  }

  get progressLabel(): string {
    return `${this.number(this.questionIndex + 1)} من ${this.number(COUNT)}`;
  }

  progressDotLabel(index: number): string {
    if (index < this.questionIndex) return `تم السؤال ${this.number(index + 1)}`;
    if (index === this.questionIndex) return `السؤال الحالي ${this.number(index + 1)} من ${this.number(COUNT)}`;
    return `السؤال ${this.number(index + 1)} من ${this.number(COUNT)}`;
  }

  trackByNumber(_: number, value: number): number {
    return value;
  }

  trackByVideo(_: number, video: VideoLink): string {
    return video.url;
  }

  emptyTimings(): Timing[] {
    return Array.from({ length: COUNT }, () => ({ start: null, end: null }));
  }

  private emptyConfig(table: number): TableConfig {
    return { table, audio: AUDIO_PATHS[table] ?? null, timings: this.emptyTimings() };
  }

  private emptyConfigs(): TableConfig[] {
    return TABLE_NUMBERS.map(table => this.emptyConfig(table));
  }

  private normalizeTimings(value: unknown): Timing[] {
    const source = Array.isArray(value) ? value : [];
    return this.questions.map((_, index) => {
      const timing = source[index] as { start?: unknown; end?: unknown } | undefined;
      return {
        start: typeof timing?.start === 'number' && Number.isFinite(timing.start) ? timing.start : null,
        end: typeof timing?.end === 'number' && Number.isFinite(timing.end) ? timing.end : null,
      };
    });
  }

  private defaultConfigs(): TableConfig[] {
    const defaults = (defaultTimingConfig as TimingConfig).tables;
    return TABLE_NUMBERS.map(table => {
      const defaultConfig = defaults.find(config => config.table === table);
      return { table, audio: AUDIO_PATHS[table] ?? null, timings: this.normalizeTimings(defaultConfig?.timings) };
    });
  }

  private loadTimings(): void {
    this.tableConfigs = this.defaultConfigs();
  }

  private loadScores(): void {
    try {
      const raw = localStorage.getItem(SCORES_KEY);
      this.scores = raw ? JSON.parse(raw) as SavedScore[] : [];
    } catch {
      this.scores = [];
    }
  }

  private saveScores(): void {
    try { localStorage.setItem(SCORES_KEY, JSON.stringify(this.scores.slice(-40))); } catch { /* local progress is optional */ }
  }

  validTiming(timing: Timing): boolean {
    return Number.isFinite(timing.start) && Number.isFinite(timing.end)
      && (timing.start ?? -1) >= 0 && (timing.end ?? 0) > (timing.start ?? 0)
      && (this.audioDuration <= 0 || (timing.end ?? 0) <= this.audioDuration);
  }

  tableAvailable(table: number): boolean {
    return Boolean(AUDIO_PATHS[table]);
  }

  private async playSegment(timing: Timing, onEnded?: () => void): Promise<void> {
    const audio = this.song?.nativeElement;
    if (!audio || !this.tableAudioUrl || !this.validTiming(timing)) return;
    this.stopAudio();
    const request = this.playbackRequest;
    this.isPlayingSegment = true;
    this.audioLoading = true;
    const resolvedUrl = new URL(this.tableAudioUrl, document.baseURI).href;
    if (audio.src !== resolvedUrl) {
      audio.src = this.tableAudioUrl;
      audio.load();
    } else if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
      audio.load();
    }
    try {
      await this.waitForAudioReady(audio);
      if (request !== this.playbackRequest) return;
      audio.currentTime = timing.start ?? 0;
      await audio.play();
      if (request !== this.playbackRequest) return;
      this.audioLoading = false;
    } catch {
      if (request !== this.playbackRequest) return;
      this.isPlayingSegment = false;
      this.audioLoading = false;
      this.gameError = 'تعذّر تشغيل الصوت. اضغط إعادة المحاولة.';
      return;
    }
    this.segmentTimer = window.setInterval(() => {
      if (audio.currentTime >= (timing.end ?? 0) - 0.03) {
        this.stopAudio();
        onEnded?.();
      }
    }, 35);
  }

  private waitForAudioReady(audio: HTMLAudioElement): Promise<void> {
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let timeout: number | null = window.setTimeout(() => finish(new Error('audio-timeout')), 15000);
      const cleanup = (): void => {
        audio.removeEventListener('canplay', ready);
        audio.removeEventListener('loadeddata', ready);
        audio.removeEventListener('error', failed);
        if (timeout !== null) window.clearTimeout(timeout);
        timeout = null;
      };
      const finish = (error?: Error): void => {
        cleanup();
        if (error) reject(error); else resolve();
      };
      const ready = (): void => finish();
      const failed = (): void => finish(new Error('audio-error'));
      audio.addEventListener('canplay', ready, { once: true });
      audio.addEventListener('loadeddata', ready, { once: true });
      audio.addEventListener('error', failed, { once: true });
    });
  }

  stopAudio(): void {
    this.playbackRequest++;
    if (this.segmentTimer !== null) window.clearInterval(this.segmentTimer);
    this.segmentTimer = null;
    if (this.advanceTimer !== null) window.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    this.song?.nativeElement.pause();
    this.isPlayingSegment = false;
    this.audioLoading = false;
  }

  retryAudio(): void {
    this.gameError = '';
    if (this.screen === 'game') this.playCurrentQuestion();
  }

  chooseTable(table: number): void {
    if (!this.tableAvailable(table)) return;
    this.table = table;
    this.closeMenu(false);
    this.screen = 'home';
  }

  start(mode: Mode): void {
    this.mode = mode;
    if (!this.tableAudioUrl) {
      this.gameError = `لا يوجد تسجيل ل${this.tableLabel(this.table)} حتى الآن.`;
      return;
    }
    if (!this.timingReady) {
      this.gameError = `تعذّر تجهيز ${this.tableLabel(this.table)}. أعد تحميل الصفحة وحاول مرة أخرى.`;
      return;
    }
    this.order = this.questions.slice();
    if (mode === 'shuffle') this.shuffle(this.order);
    this.questionIndex = 0;
    this.score = 0;
    this.missed.clear();
    this.wrongOptions.clear();
    this.feedback = 'none';
    this.gameError = '';
    this.audioDuration = 0;
    this.screen = 'game';
    this.prepareQuestion();
  }

  private prepareQuestion(): void {
    this.options = this.makeOptions();
    this.wrongOptions.clear();
    this.feedback = 'none';
    this.awaitingAnswer = false;
    this.playCurrentQuestion();
  }

  private playCurrentQuestion(): void {
    this.gameError = '';
    const timing = this.currentTiming;
    void this.playSegment(timing, () => {
      this.awaitingAnswer = true;
    });
  }

  answer(value: number): void {
    if (!this.awaitingAnswer || this.wrongOptions.has(value)) return;
    if (value === this.currentAnswer) {
      if (!this.missed.has(this.currentFactor)) this.score++;
      this.feedback = 'correct';
      this.awaitingAnswer = false;
      this.playTone('correct');
      this.advanceTimer = window.setTimeout(() => this.advanceQuestion(), 650);
    } else {
      this.missed.add(this.currentFactor);
      this.wrongOptions.add(value);
      this.feedback = 'wrong';
      this.playTone('wrong');
    }
  }

  replay(): void {
    this.feedback = 'none';
    this.awaitingAnswer = false;
    this.playCurrentQuestion();
  }

  private advanceQuestion(): void {
    this.advanceTimer = null;
    this.questionIndex++;
    if (this.questionIndex >= COUNT) {
      this.finalScore = this.score;
      this.scores.push({ score: this.score, total: COUNT, mode: this.mode, table: this.table, playedAt: new Date().toISOString() });
      this.saveScores();
      this.stopAudio();
      this.screen = 'complete';
      return;
    }
    this.prepareQuestion();
  }

  playAgain(): void {
    this.start(this.mode);
  }

  backHome(): void {
    this.stopAudio();
    this.screen = 'home';
    this.gameError = '';
    this.closeMenu(false);
  }

  toggleMenu(): void {
    if (this.menuOpen) {
      this.closeMenu();
      return;
    }
    this.menuOpen = true;
    window.setTimeout(() => this.drawerClose?.nativeElement.focus(), 0);
  }

  closeMenu(returnFocus = true): void {
    const wasOpen = this.menuOpen;
    this.menuOpen = false;
    if (returnFocus && wasOpen) window.setTimeout(() => this.menuButton?.nativeElement.focus(), 0);
  }

  private makeOptions(): number[] {
    const answer = this.currentAnswer;
    const nearby = this.currentFactor === 1 ? [this.table * 2, this.table * 3] : [this.table * (this.currentFactor - 1), this.table * (this.currentFactor + 1)];
    const values = [...new Set([answer, ...nearby])].filter(value => value > 0);
    while (values.length < 3) values.push(answer + values.length * this.table);
    return this.shuffle(values.slice(0, 3));
  }

  private shuffle<T>(values: T[]): T[] {
    for (let index = values.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [values[index], values[target]] = [values[target], values[index]];
    }
    return values;
  }

  private playTone(kind: 'correct' | 'wrong'): void {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const notes = kind === 'correct' ? [523.25, 659.25] : [220, 155];
    const now = context.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.1;
      oscillator.type = kind === 'correct' ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.1, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
    window.setTimeout(() => void context.close(), 500);
  }
}
