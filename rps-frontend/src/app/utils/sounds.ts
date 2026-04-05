// Sound effects for the game

class SoundManager {
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    // Create sound effects using Web Audio API and data URIs
    this.initSounds();
  }

  private initSounds() {
    // Simple beep sounds using oscillator (will create on-demand)
    // These are placeholders - in production you'd load actual audio files
  }

  private createBeep(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.enabled) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(this.volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  }

  playClick() {
    this.createBeep(800, 0.05, 'square');
  }

  playSelect() {
    this.createBeep(600, 0.1, 'sine');
  }

  playWin() {
    if (!this.enabled) return;
    // Victory sound - ascending tones
    setTimeout(() => this.createBeep(523, 0.15, 'sine'), 0);    // C
    setTimeout(() => this.createBeep(659, 0.15, 'sine'), 150);  // E
    setTimeout(() => this.createBeep(784, 0.3, 'sine'), 300);   // G
  }

  playLose() {
    if (!this.enabled) return;
    // Defeat sound - descending tones
    setTimeout(() => this.createBeep(400, 0.15, 'sine'), 0);
    setTimeout(() => this.createBeep(300, 0.15, 'sine'), 150);
    setTimeout(() => this.createBeep(200, 0.3, 'sine'), 300);
  }

  playTie() {
    this.createBeep(440, 0.2, 'sine');
  }

  playReveal() {
    this.createBeep(1000, 0.1, 'triangle');
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getVolume(): number {
    return this.volume;
  }
}

export const soundManager = new SoundManager();
