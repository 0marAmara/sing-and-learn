import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import defaultTimingConfig from '../assets/timings.json';
import { SavedScore, Timing, TimingConfig } from './models';

type Screen = 'home' | 'game' | 'setup' | 'complete';
type Mode = 'ordered' | 'shuffle';
type Feedback = 'none' | 'wrong' | 'correct';

const COUNT = 10;
const TIMINGS_KEY = 'sing-and-learn.timings.v2';
const SCORES_KEY = 'sing-and-learn.scores.v1';

@Component({
  selector: 'sal-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('song') song?: ElementRef<HTMLAudioElement>;

  readonly tables = Array.from({ length: 8 }, (_, index) => index + 2);
  readonly questions = Array.from({ length: COUNT }, (_, index) => index + 1);
  readonly audioUrl = 'assets/audio/multiplication-song.mpeg';
  readonly table = 2;

  screen: Screen = 'home';
  mode: Mode = 'ordered';
  menuOpen = false;
  timings: Timing[] = this.emptyTimings();
  audioDuration = 0;
  currentTime = 0;
  audioStatus = 'التسجيل جاهز للإعداد.';
  setupError = '';
  copyStatus = '';
  gameError = '';
  isPlayingSegment = false;
  awaitingAnswer = false;
  feedback: Feedback = 'none';
  order: number[] = [];
  questionIndex = 0;
  options: number[] = [];
  wrongOptions = new Set<number>();
  score = 0;
  missed = new Set<number>();
  firstAttempt = new Set<number>();
  scores: SavedScore[] = [];
  finalScore = 0;

  private segmentTimer: number | null = null;
  private advanceTimer: number | null = null;

  constructor() {
    this.loadTimings();
    this.loadScores();
  }

  ngAfterViewInit(): void {
    const audio = this.song?.nativeElement;
    audio?.addEventListener('loadedmetadata', () => {
      this.audioDuration = audio.duration;
      this.audioStatus = `مدة التسجيل: ${this.number(this.audioDuration)} ثانية.`;
    });
    audio?.addEventListener('timeupdate', () => { this.currentTime = audio.currentTime; });
    audio?.addEventListener('error', () => { this.audioStatus = 'تعذّر تحميل التسجيل. جرّب إعادة التحميل.'; });
  }

  ngOnDestroy(): void {
    this.stopAudio();
  }

  number(value: number): string {
    return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2, useGrouping: false }).format(value);
  }

  get timingReady(): boolean {
    return this.timings.every((timing, index) => this.validTiming(timing)
      && (index === 0 || (this.timings[index - 1].start ?? 0) <= (timing.start ?? 0)));
  }

  get reviewedCount(): number {
    return this.timings.filter((timing) => this.validTiming(timing)).length;
  }

  get bestScore(): SavedScore | undefined {
    return this.scores.slice().sort((a, b) => b.score - a.score)[0];
  }

  get currentFactor(): number {
    return this.order[this.questionIndex] ?? 1;
  }

  get currentAnswer(): number {
    return this.table * this.currentFactor;
  }

  get currentTiming(): Timing {
    return this.timings[this.currentFactor - 1] ?? { start: null, end: null };
  }

  get jsonExport(): string {
    return `${JSON.stringify({ table: this.table, timings: this.timings }, null, 2)}\n`;
  }

  get progressLabel(): string {
    return `${this.number(this.questionIndex + 1)} من ${this.number(COUNT)}`;
  }

  emptyTimings(): Timing[] {
    return Array.from({ length: COUNT }, () => ({ start: null, end: null }));
  }

  private loadTimings(): void {
    try {
      const raw = localStorage.getItem(TIMINGS_KEY);
      if (!raw) {
        this.timings = defaultTimingConfig.timings.map(timing => ({ start: timing.start, end: timing.end }));
        return;
      }
      if (raw) {
        const parsed = JSON.parse(raw) as TimingConfig;
        if (parsed.table === 2 && Array.isArray(parsed.timings) && parsed.timings.length === COUNT) {
          this.timings = parsed.timings.map(timing => ({ start: timing.start ?? null, end: timing.end ?? null }));
        }
      }
    } catch {
      this.setupError = 'تعذّر قراءة التوقيتات المحفوظة. يمكنك إدخالها من جديد.';
    }
  }

  private loadScores(): void {
    try {
      const raw = localStorage.getItem(SCORES_KEY);
      this.scores = raw ? JSON.parse(raw) as SavedScore[] : [];
    } catch {
      this.scores = [];
    }
  }

  private saveDraft(): void {
    try {
      localStorage.setItem(TIMINGS_KEY, JSON.stringify({ table: this.table, timings: this.timings }));
    } catch {
      this.setupError = 'لم يسمح المتصفح بالحفظ. انسخ JSON قبل إغلاق الصفحة.';
    }
  }

  private saveScores(): void {
    try { localStorage.setItem(SCORES_KEY, JSON.stringify(this.scores.slice(-20))); } catch { /* local progress is optional */ }
  }

  validTiming(timing: Timing): boolean {
    return Number.isFinite(timing.start) && Number.isFinite(timing.end)
      && (timing.start ?? -1) >= 0 && (timing.end ?? 0) > (timing.start ?? 0)
      && (!this.audioDuration || (timing.end ?? 0) <= this.audioDuration);
  }

  updateTiming(index: number, field: 'start' | 'end', value: number | string | null): void {
    const numeric = value === '' || value === null ? null : Number(value);
    this.timings[index] = { ...this.timings[index], [field]: Number.isFinite(numeric) ? numeric : null };
    this.setupError = '';
    this.saveDraft();
  }

  markTime(index: number, field: 'start' | 'end'): void {
    this.updateTiming(index, field, Number(this.currentTime.toFixed(2)));
    if (field === 'end') this.song?.nativeElement.pause();
  }

  seek(): void {
    const audio = this.song?.nativeElement;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(this.currentTime, this.audioDuration || audio.duration || this.currentTime));
  }

  async preview(index: number): Promise<void> {
    const timing = this.timings[index];
    if (!this.validTiming(timing)) {
      this.setupError = `أدخل بداية ونهاية صحيحتين للسؤال ${this.number(index + 1)} أولًا.`;
      return;
    }
    await this.playSegment(timing, () => { this.audioStatus = `انتهت معاينة السؤال ${this.number(index + 1)}.`; });
  }

  private async playSegment(timing: Timing, onEnded?: () => void): Promise<void> {
    const audio = this.song?.nativeElement;
    if (!audio || !this.validTiming(timing)) return;
    this.stopAudio();
    this.isPlayingSegment = true;
    this.audioStatus = 'نستمع إلى المقطع…';
    audio.currentTime = timing.start ?? 0;
    try {
      await audio.play();
    } catch {
      this.isPlayingSegment = false;
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

  stopAudio(): void {
    if (this.segmentTimer !== null) window.clearInterval(this.segmentTimer);
    this.segmentTimer = null;
    if (this.advanceTimer !== null) window.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    const audio = this.song?.nativeElement;
    audio?.pause();
    this.isPlayingSegment = false;
  }

  retryAudio(): void {
    if (this.screen === 'game') this.playCurrentQuestion();
    else void this.preview(this.currentFactor - 1);
  }

  openSetup(): void {
    this.stopAudio();
    this.screen = 'setup';
    this.setupError = '';
    this.copyStatus = '';
    this.menuOpen = false;
  }

  closeSetup(): void {
    this.stopAudio();
    this.screen = 'home';
    this.menuOpen = false;
  }

  saveTimings(): void {
    const invalid = this.timings.findIndex(timing => !this.validTiming(timing));
    if (invalid !== -1) {
      this.setupError = `أكمل السؤال ${this.number(invalid + 1)}، وتأكد أن النهاية بعد البداية وداخل التسجيل.`;
      return;
    }
    const overlap = this.timings.findIndex((timing, index) => index > 0 && (this.timings[index - 1].start ?? 0) > (timing.start ?? 0));
    if (overlap !== -1) {
      this.setupError = `بداية السؤال ${this.number(overlap + 1)} يجب أن تأتي بعد بداية السؤال السابق.`;
      return;
    }
    this.saveDraft();
    this.setupError = '';
    this.audioStatus = 'تم حفظ التوقيتات. يمكن للأطفال بدء اللعب الآن.';
  }

  async copyJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.jsonExport);
      this.copyStatus = 'نُسخ JSON. الصقه في رسالتك التالية.';
    } catch {
      this.copyStatus = 'لم ينجح النسخ التلقائي. حدّد النص وانسخه يدويًا.';
    }
  }

  downloadJson(): void {
    const blob = new Blob([this.jsonExport], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'multiplication-table-2-timings.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  chooseTable(table: number): void {
    if (table !== 2) return;
    this.menuOpen = false;
    this.screen = 'home';
  }

  start(mode: Mode): void {
    this.mode = mode;
    if (!this.timingReady) {
      this.openSetup();
      this.setupError = 'اضبط مقاطع الأغنية العشرة أولًا، ثم نبدأ اللعب.';
      return;
    }
    this.order = this.questions.slice();
    if (mode === 'shuffle') this.shuffle(this.order);
    this.questionIndex = 0;
    this.score = 0;
    this.missed.clear();
    this.firstAttempt.clear();
    this.wrongOptions.clear();
    this.feedback = 'none';
    this.gameError = '';
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
      this.audioStatus = 'اختر إجابتك عندما تكون جاهزًا.';
    });
  }

  answer(value: number): void {
    if (!this.awaitingAnswer || this.wrongOptions.has(value)) return;
    if (value === this.currentAnswer) {
      if (!this.missed.has(this.currentFactor)) this.score++;
      this.firstAttempt.add(this.currentFactor);
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
      this.scores.push({ score: this.score, total: COUNT, mode: this.mode, playedAt: new Date().toISOString() });
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
    this.menuOpen = false;
  }

  private makeOptions(): number[] {
    const answer = this.currentAnswer;
    const nearby = this.currentFactor === 1 ? [4, 6] : [this.table * (this.currentFactor - 1), this.table * (this.currentFactor + 1)];
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
