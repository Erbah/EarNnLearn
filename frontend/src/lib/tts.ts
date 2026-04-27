/**
 * Text-to-Speech Service
 * Supports Web Speech API + optional provider backends
 */

export interface TTSProvider {
  speak(text: string, voice?: string): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  setVolume(volume: number): void;
  getAvailableVoices(): Promise<string[]>;
}

export class WebSpeechTTS implements TTSProvider {
  private synth: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isCancelling = false;
  private currentVolume: number = 1;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  async speak(text: string, voice?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Mark that we're cancelling so we can ignore interruption errors
      if (this.currentUtterance) {
        this.isCancelling = true;
        this.synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = this.currentVolume;

      // Set voice if specified
      const voices = this.synth.getVoices();
      if (voice && voices.length > 0) {
        const selectedVoice = voices.find(v => v.name === voice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      const timeout = setTimeout(() => {
        console.warn('Web Speech API timed out - resolving anyway');
        this.isCancelling = false;
        resolve();
      }, 10000);

      utterance.onend = () => {
        clearTimeout(timeout);
        this.isCancelling = false;
        resolve();
      };
      
      utterance.onerror = (event) => {
        clearTimeout(timeout);
        this.isCancelling = false;
        // Handle different error types gracefully
        switch (event.error) {
          case 'interrupted':
          case 'canceled':
            // Intentional cancellation, resolve successfully
            resolve();
            return;
          case 'not-allowed':
            // Browser blocked speech synthesis (e.g., no user interaction, audio permissions denied)
            // Log warning but don't fail - let lesson continue with visual effects
            console.warn(
              'Web Speech API blocked. Ensure the page has user interaction and audio permissions are granted.'
            );
            resolve();
            return;
          case 'network':
          case 'service-not-available':
            // Temporary network/service issues, skip audio but continue
            console.warn(`Speech service temporarily unavailable: ${event.error}`);
            resolve();
            return;
          default:
            // Other errors are logged but don't block lesson progression
            console.error(`Speech error: ${event.error}`);
            resolve();
            return;
        }
      };

      this.currentUtterance = utterance;
      this.isCancelling = false;
      this.synth.speak(utterance);
    });
  }

  stop(): void {
    this.synth.cancel();
    this.currentUtterance = null;
  }

  pause(): void {
    if (this.synth.speaking) {
      this.synth.pause();
    }
  }

  resume(): void {
    if (this.synth.paused) {
      this.synth.resume();
    }
  }

  setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.currentUtterance && this.synth.speaking && !this.synth.paused) {
      // WebSpeech API has limited support for live volume changes. 
      // For immediate effect on some browsers, we might need more complex logic,
      // but for now, we save it for the next utterance or platform that supports it.
      this.currentUtterance.volume = this.currentVolume;
    }
  }

  async getAvailableVoices(): Promise<string[]> {
    return new Promise((resolve) => {
      const voices = this.synth.getVoices();
      if (voices.length > 0) {
        resolve(voices.map(v => v.name));
      } else {
        // Some browsers load voices asynchronously
        this.synth.onvoiceschanged = () => {
          resolve(this.synth.getVoices().map(v => v.name));
        };
      }
    });
  }
}

export class OpenAITTS implements TTSProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';
  private currentAudio: HTMLAudioElement | null = null;
  private currentVolume: number = 1;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async speak(text: string, voice: string = 'alloy'): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS error: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (this.currentAudio) {
        this.currentAudio.pause();
      }

      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = this.currentVolume;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn('OpenAI Audio timed out - resolving anyway');
          resolve(null);
        }, 15000); // 15s for network audio

        this.currentAudio!.onended = () => {
          clearTimeout(timeout);
          resolve(null);
        };
        this.currentAudio!.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Audio playback failed'));
        };
        this.currentAudio!.play();
      });
    } catch (error) {
      console.error('TTS error:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  pause(): void {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
    }
  }

  resume(): void {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
    }
  }

  setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this.currentVolume;
    }
  }

  async getAvailableVoices(): Promise<string[]> {
    return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  }
}

let ttsProvider: TTSProvider | null = null;

export function initTTS(provider: TTSProvider): void {
  ttsProvider = provider;
}

export function getTTSProvider(): TTSProvider {
  if (!ttsProvider) {
    ttsProvider = new WebSpeechTTS();
  }
  return ttsProvider;
}

export async function speak(text: string, voice?: string): Promise<void> {
  const provider = getTTSProvider();
  return provider.speak(text, voice);
}

export function stopSpeech(): void {
  const provider = getTTSProvider();
  provider.stop();
}

export function pauseSpeech(): void {
  const provider = getTTSProvider();
  provider.pause();
}

export function resumeSpeech(): void {
  const provider = getTTSProvider();
  provider.resume();
}

export function setSpeechVolume(volume: number): void {
  const provider = getTTSProvider();
  provider.setVolume(volume);
}
