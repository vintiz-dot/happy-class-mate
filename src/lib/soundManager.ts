/**
 * Premium Sound Manager
 * Provides subtle audio feedback for user interactions
 * Respects user preferences and accessibility settings
 */

type SoundType = 'click' | 'success' | 'error' | 'notification' | 'hover' | 'navigation';

class SoundManager {
  private context: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.3;
  private sounds: Map<SoundType, () => void> = new Map();

  constructor() {
    // Check if user prefers reduced motion (also disable sounds)
    if (typeof window !== 'undefined') {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.enabled = !prefersReducedMotion;
      
      // Load preference from localStorage
      const storedEnabled = localStorage.getItem('sound-enabled');
      if (storedEnabled !== null) {
        this.enabled = storedEnabled === 'true';
      }

      const storedVolume = localStorage.getItem('sound-volume');
      if (storedVolume !== null) {
        this.volume = parseFloat(storedVolume);
      }
    }

    this.initContext();
    this.setupSounds();
  }

  private initContext() {
    if (typeof window !== 'undefined' && !this.context) {
      try {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
  }

  private setupSounds() {
    // Define sound generators using oscillators
    this.sounds.set('click', () => this.playTone(800, 0.03, 'sine'));
    this.sounds.set('success', () => this.playChord([523.25, 659.25, 783.99], 0.15));
    this.sounds.set('error', () => this.playTone(200, 0.1, 'square'));
    this.sounds.set('notification', () => this.playChord([659.25, 783.99], 0.2));
    this.sounds.set('hover', () => this.playTone(1200, 0.02, 'sine'));
    this.sounds.set('navigation', () => this.playTone(600, 0.05, 'sine'));
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.enabled || !this.context) return;

    try {
      // Resume context if suspended (required by browser autoplay policies)
      if (this.context.state === 'suspended') {
        this.context.resume();
      }

      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      // Envelope: quick attack, exponential decay
      const now = this.context.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (e) {
      console.warn('Error playing sound:', e);
    }
  }

  private playChord(frequencies: number[], duration: number) {
    if (!this.enabled || !this.context) return;

    frequencies.forEach((freq, index) => {
      setTimeout(() => this.playTone(freq, duration * 0.8, 'sine'), index * 50);
    });
  }

  play(soundType: SoundType) {
    const soundFn = this.sounds.get(soundType);
    if (soundFn) {
      soundFn();
    }
  }

  enable() {
    this.enabled = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound-enabled', 'true');
    }
  }

  disable() {
    this.enabled = false;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound-enabled', 'false');
    }
  }

  toggle() {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.enabled;
  }

  setVolume(level: number) {
    this.volume = Math.max(0, Math.min(1, level));
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound-volume', this.volume.toString());
    }
  }

  getVolume(): number {
    return this.volume;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
export const soundManager = new SoundManager();
