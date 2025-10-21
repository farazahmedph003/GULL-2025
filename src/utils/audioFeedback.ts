import * as Tone from 'tone';

// ============================================
// AUDIO FEEDBACK SYSTEM
// ============================================

export interface SoundVolumeSettings {
  master: number;
  money: number;
  notifications: number;
  navigation: number;
  ui: number;
}

class AudioFeedbackService {
  private static instance: AudioFeedbackService;
  private initialized = false;
  private enabled = true;
  private volumes: SoundVolumeSettings = {
    master: 1.0,
    money: 0.8,
    notifications: 0.6,
    navigation: 0.4,
    ui: 0.3
  };

  private constructor() {
    // Load volume settings from localStorage
    this.loadVolumeSettings();
  }

  static getInstance(): AudioFeedbackService {
    if (!AudioFeedbackService.instance) {
      AudioFeedbackService.instance = new AudioFeedbackService();
    }
    return AudioFeedbackService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await Tone.start();
      this.initialized = true;
    } catch (err) {
      console.warn('Audio feedback initialization failed:', err);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem('gull_sound_enabled', enabled.toString());
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ============================================
  // VOLUME CONTROL METHODS
  // ============================================

  private loadVolumeSettings(): void {
    try {
      const saved = localStorage.getItem('gull_sound_volumes');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.volumes = { ...this.volumes, ...parsed };
      }

      const savedEnabled = localStorage.getItem('gull_sound_enabled');
      if (savedEnabled !== null) {
        this.enabled = savedEnabled === 'true';
      }
    } catch (err) {
      console.warn('Failed to load sound settings:', err);
    }
  }

  private saveVolumeSettings(): void {
    try {
      localStorage.setItem('gull_sound_volumes', JSON.stringify(this.volumes));
    } catch (err) {
      console.warn('Failed to save sound settings:', err);
    }
  }

  getVolumeSettings(): SoundVolumeSettings {
    return { ...this.volumes };
  }

  setVolume(category: keyof Omit<SoundVolumeSettings, 'master'>, volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.volumes[category] = clampedVolume;
    this.saveVolumeSettings();
  }

  setMasterVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.volumes.master = clampedVolume;
    this.saveVolumeSettings();
  }

  private getEffectiveVolume(category: keyof Omit<SoundVolumeSettings, 'master'>): number {
    return this.volumes.master * this.volumes[category];
  }

  // ============================================
  // AUDIO FILE PLAYBACK
  // ============================================

  private async playAudioFile(filePath: string, volume: number = 1.0, category: keyof Omit<SoundVolumeSettings, 'master'> = 'ui'): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume(category) <= 0) return;

    try {
      const audio = new Audio(filePath);
      audio.volume = volume * this.getEffectiveVolume(category);
      
      // Handle loading errors gracefully and silently
      audio.onerror = () => {
        // Silently fail - audio file might not exist
        return;
      };

      // Check if audio can be played before attempting
      audio.preload = 'none';
      await audio.play();
    } catch (err) {
      // Silently handle audio errors - files might not exist
      return;
    }
  }

  // ============================================
  // SOUND EFFECTS
  // ============================================

  /**
   * Play success sound (transaction added)
   */
  async playSuccess(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('ui') <= 0) return;
    
    // Try audio file first, fallback to Tone.js
    try {
      await this.playAudioFile('/sounds/notification-success.mp3', 1.0, 'ui');
      return;
    } catch {
      // Fallback to Tone.js
    }

    await this.initialize();
    const volume = this.getEffectiveVolume('ui');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('C5', '0.1', Tone.now());
      synth.triggerAttackRelease('E5', '0.1', Tone.now() + 0.1);

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  }

  /**
   * Play error sound
   */
  async playError(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('notifications') <= 0) return;
    
    // Try audio file first, fallback to Tone.js
    try {
      await this.playAudioFile('/sounds/notification-error.mp3', 1.0, 'notifications');
      return;
    } catch {
      // Fallback to Tone.js
    }

    await this.initialize();
    const volume = this.getEffectiveVolume('notifications');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.3 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('E3', '0.2', Tone.now());

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  }

  /**
   * Play delete sound
   */
  async playDelete(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('ui') <= 0) return;
    await this.initialize();
    const volume = this.getEffectiveVolume('ui');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.3 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('G3', '0.15', Tone.now());

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  }

  /**
   * Play click sound (button press)
   */
  async playClick(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('ui') <= 0) return;
    await this.initialize();
    const volume = this.getEffectiveVolume('ui');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('A4', '0.05', Tone.now());

      setTimeout(() => synth.dispose(), 500);
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  }

  /**
   * Play notification sound
   */
  async playNotification(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('notifications') <= 0) return;
    
    // Try audio file first, fallback to Tone.js
    try {
      await this.playAudioFile('/sounds/notification-info.mp3', 1.0, 'notifications');
      return;
    } catch {
      // Fallback to Tone.js
    }

    await this.initialize();
    const volume = this.getEffectiveVolume('notifications');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.5 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('A4', '0.1', Tone.now());
      synth.triggerAttackRelease('E5', '0.1', Tone.now() + 0.15);

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  }

  /**
   * Play undo sound
   */
  async playUndo(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('ui') <= 0) return;
    await this.initialize();
    const volume = this.getEffectiveVolume('ui');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('D4', '0.1', Tone.now());
      synth.triggerAttackRelease('A3', '0.1', Tone.now() + 0.1);

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  }

  /**
   * Play redo sound
   */
  async playRedo(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('ui') <= 0) return;
    await this.initialize();
    const volume = this.getEffectiveVolume('ui');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('A3', '0.1', Tone.now());
      synth.triggerAttackRelease('D4', '0.1', Tone.now() + 0.1);

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  }

  /**
   * Play completion sound (bulk operation)
   */
  async playCompletion(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('ui') <= 0) return;
    await this.initialize();
    const volume = this.getEffectiveVolume('ui');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.5 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('C4', '0.1', Tone.now());
      synth.triggerAttackRelease('E4', '0.1', Tone.now() + 0.1);
      synth.triggerAttackRelease('G4', '0.2', Tone.now() + 0.2);

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  }

  // ============================================
  // MONEY-RELATED SOUNDS
  // ============================================

  /**
   * Play money deposit sound with volume variation based on amount
   */
  async playMoneyDeposit(amount: number): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('money') <= 0) return;

    // Calculate volume based on amount (larger amounts = more prominent sound)
    const volumeMultiplier = Math.min(1.5, Math.max(0.3, Math.log(amount / 1000 + 1) / 3));
    
    // Try audio file first, fallback to Tone.js
    try {
      const soundFile = amount >= 10000 ? '/sounds/deposit-large.mp3' : '/sounds/deposit.mp3';
      await this.playAudioFile(soundFile, volumeMultiplier, 'money');
      return;
    } catch {
      // Fallback to Tone.js with cash register-like sound
    }

    await this.initialize();
    const volume = this.getEffectiveVolume('money') * volumeMultiplier;

    try {
      // Create a "cha-ching" effect
      const synth1 = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.3 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      const synth2 = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.4 },
        volume: Tone.gainToDb(volume * 0.8)
      }).toDestination();

      // "Cha" sound
      synth1.triggerAttackRelease('C5', '0.2', Tone.now());
      // "Ching" sound
      synth2.triggerAttackRelease('G5', '0.3', Tone.now() + 0.15);

      setTimeout(() => {
        synth1.dispose();
        synth2.dispose();
      }, 1500);
    } catch (err) {
      console.warn('Money deposit sound failed:', err);
    }
  }

  /**
   * Play money deduction sound with volume variation based on amount
   */
  async playMoneyDeduct(amount: number): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('money') <= 0) return;

    // Calculate volume based on amount
    const volumeMultiplier = Math.min(1.2, Math.max(0.4, Math.log(amount / 1000 + 1) / 4));
    
    // Try audio file first, fallback to Tone.js
    try {
      const soundFile = amount >= 10000 ? '/sounds/deduct-large.mp3' : '/sounds/deduct.mp3';
      await this.playAudioFile(soundFile, volumeMultiplier, 'money');
      return;
    } catch {
      // Fallback to Tone.js with subtle "whoosh" sound
    }

    await this.initialize();
    const volume = this.getEffectiveVolume('money') * volumeMultiplier;

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.2 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      // Subtle descending whoosh
      synth.triggerAttackRelease('E4', '0.4', Tone.now());
      synth.triggerAttackRelease('C4', '0.3', Tone.now() + 0.2);

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Money deduct sound failed:', err);
    }
  }

  /**
   * Play top-up request sound
   */
  async playTopupRequest(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('money') <= 0) return;
    await this.initialize();
    const volume = this.getEffectiveVolume('money');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.4 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('F4', '0.2', Tone.now());
      synth.triggerAttackRelease('A4', '0.2', Tone.now() + 0.1);

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Top-up request sound failed:', err);
    }
  }

  // ============================================
  // NAVIGATION SOUNDS
  // ============================================

  /**
   * Play navigation sound (route changes)
   */
  async playNavigate(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('navigation') <= 0) return;
    await this.initialize();
    const volume = this.getEffectiveVolume('navigation');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.1 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('A4', '0.1', Tone.now());

      setTimeout(() => synth.dispose(), 500);
    } catch (err) {
      console.warn('Navigation sound failed:', err);
    }
  }

  /**
   * Play reload/refresh sound
   */
  async playReload(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('ui') <= 0) return;
    await this.initialize();
    const volume = this.getEffectiveVolume('ui');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.05, sustain: 0, release: 0.1 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('D5', '0.08', Tone.now());
      synth.triggerAttackRelease('F5', '0.08', Tone.now() + 0.05);

      setTimeout(() => synth.dispose(), 500);
    } catch (err) {
      console.warn('Reload sound failed:', err);
    }
  }

  // ============================================
  // NOTIFICATION TYPE SOUNDS
  // ============================================

  /**
   * Play notification sound by type
   */
  async playNotificationByType(type: 'success' | 'error' | 'warning' | 'info'): Promise<void> {
    switch (type) {
      case 'success':
        await this.playAudioFile('/sounds/notification-success.mp3', 1.0, 'notifications');
        break;
      case 'error':
        await this.playAudioFile('/sounds/notification-error.mp3', 1.0, 'notifications');
        break;
      case 'warning':
        await this.playAudioFile('/sounds/notification-warning.mp3', 1.0, 'notifications');
        break;
      case 'info':
      default:
        await this.playAudioFile('/sounds/notification-info.mp3', 1.0, 'notifications');
        break;
    }
    
    // Fallback to existing methods if audio files fail
    if (!this.enabled || this.getEffectiveVolume('notifications') <= 0) return;
    
    switch (type) {
      case 'success':
        await this.playSuccess();
        break;
      case 'error':
        await this.playError();
        break;
      case 'warning':
        await this.playWarning();
        break;
      case 'info':
      default:
        await this.playNotification();
        break;
    }
  }

  /**
   * Play warning sound
   */
  async playWarning(): Promise<void> {
    if (!this.enabled || this.getEffectiveVolume('notifications') <= 0) return;
    
    try {
      await this.playAudioFile('/sounds/notification-warning.mp3', 1.0, 'notifications');
      return;
    } catch {
      // Fallback to Tone.js
    }

    await this.initialize();
    const volume = this.getEffectiveVolume('notifications');

    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.3 },
        volume: Tone.gainToDb(volume)
      }).toDestination();

      synth.triggerAttackRelease('F3', '0.2', Tone.now());
      synth.triggerAttackRelease('F3', '0.2', Tone.now() + 0.15);

      setTimeout(() => synth.dispose(), 1000);
    } catch (err) {
      console.warn('Warning sound failed:', err);
    }
  }
}

// Export singleton instance
export const audioFeedback = AudioFeedbackService.getInstance();

// Convenience functions
export const playSuccessSound = () => audioFeedback.playSuccess();
export const playErrorSound = () => audioFeedback.playError();
export const playDeleteSound = () => audioFeedback.playDelete();
export const playClickSound = () => audioFeedback.playClick();
export const playNotificationSound = () => audioFeedback.playNotification();
export const playUndoSound = () => audioFeedback.playUndo();
export const playRedoSound = () => audioFeedback.playRedo();
export const playCompletionSound = () => audioFeedback.playCompletion();

// New convenience functions for money and navigation
export const playMoneyDepositSound = (amount: number) => audioFeedback.playMoneyDeposit(amount);
export const playMoneyDeductSound = (amount: number) => audioFeedback.playMoneyDeduct(amount);
export const playTopupRequestSound = () => audioFeedback.playTopupRequest();
export const playNavigateSound = () => audioFeedback.playNavigate();
export const playReloadSound = () => audioFeedback.playReload();
export const playNotificationByType = (type: 'success' | 'error' | 'warning' | 'info') => audioFeedback.playNotificationByType(type);
export const playWarningSound = () => audioFeedback.playWarning();

