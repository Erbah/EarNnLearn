/**
 * Visual Effects Engine
 * Spotlight, laser pointer, and other visual effects
 */

export interface SpotlightState {
  active: boolean;
  elementId?: string;
  x?: number;
  y?: number;
  radius?: number;
  opacity?: number;
}

export interface LaserState {
  active: boolean;
  x?: number;
  y?: number;
  angle?: number;
  color?: string;
  length?: number;
}

export interface EffectState {
  spotlight: SpotlightState;
  laser: LaserState;
  highlighting: Set<string>;
}

class EffectsManager {
  private state: EffectState = {
    spotlight: { active: false },
    laser: { active: false },
    highlighting: new Set(),
  };

  private listeners: Set<(state: EffectState) => void> = new Set();

  subscribe(listener: (state: EffectState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  showSpotlight(elementId?: string, x?: number, y?: number): void {
    this.state.spotlight = {
      active: true,
      elementId,
      x,
      y,
      radius: 150,
      opacity: 0.7,
    };
    this.notify();
  }

  hideSpotlight(): void {
    this.state.spotlight = { active: false };
    this.notify();
  }

  showLaser(x: number, y: number, angle: number, color = '#ff0000'): void {
    this.state.laser = {
      active: true,
      x,
      y,
      angle,
      color,
      length: 300,
    };
    this.notify();
  }

  hideLaser(): void {
    this.state.laser = { active: false };
    this.notify();
  }

  highlight(elementId: string): void {
    this.state.highlighting.add(elementId);
    this.notify();
  }

  unhighlight(elementId: string): void {
    this.state.highlighting.delete(elementId);
    this.notify();
  }

  clearAll(): void {
    this.state.spotlight = { active: false };
    this.state.laser = { active: false };
    this.state.highlighting.clear();
    this.notify();
  }

  getState(): EffectState {
    return { ...this.state };
  }
}

export const effectsManager = new EffectsManager();

export function getEffects() {
  return {
    showSpotlight: (elementId?: string) => effectsManager.showSpotlight(elementId),
    hideSpotlight: () => effectsManager.hideSpotlight(),
    showLaser: (x: number, y: number, angle: number, color?: string) => effectsManager.showLaser(x, y, angle, color),
    hideLaser: () => effectsManager.hideLaser(),
    highlight: (elementId: string) => effectsManager.highlight(elementId),
    unhighlight: (elementId: string) => effectsManager.unhighlight(elementId),
    clearAll: () => effectsManager.clearAll(),
    subscribe: (listener: (state: EffectState) => void) => effectsManager.subscribe(listener),
  };
}
