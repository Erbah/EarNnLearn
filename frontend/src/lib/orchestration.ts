/**
 * Lesson Orchestration Engine
 * Coordinates agent actions, TTS, and effects during lesson playback
 */

import type { AgentAction, LessonSceneWithActions } from '@/types/lesson';
import { speak, stopSpeech } from './tts';
import { useEffects } from './effects';
// import { whiteboardManager } from './whiteboard';

export interface OrchestrationEvent {
  type: 'action_start' | 'action_end' | 'agent_change' | 'scene_complete';
  action?: AgentAction;
  timestamp: number;
}

export interface ExecutionOptions {
  onTutorHelp?: () => void;
  onEvent?: (event: OrchestrationEvent) => void;
  speedMultiplier?: number;
}

interface OrchestratorOptions {
  onEvent?: (event: OrchestrationEvent) => void;
  speedMultiplier?: number;
}

export class LessonOrchestrator {
  private isPlaying = false;
  private currentTimeout: NodeJS.Timeout | null = null;
  private options: OrchestratorOptions;
  private effects = useEffects();

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      speedMultiplier: 1,
      ...options,
    };
  }

  /**
   * Play a lesson scene with all agent actions orchestrated
   */
  async playScene(scene: LessonSceneWithActions, options?: ExecutionOptions): Promise<void> {
    this.isPlaying = true;

    try {
      // Group actions by agent and sort by timing
      const actionsByTime = this.sortActionsByTiming(scene.actions || []);
      let currentTime = 0;

      for (const action of actionsByTime) {
        if (!this.isPlaying) break;

        // Wait until it's time for this action
        const delay = action.delay ? action.delay - currentTime : 0;
        if (delay > 0) {
          await this.delay(delay);
        }

        currentTime = action.delay || 0;

        // Execute the action
        await this.executeAction(action, options);
      }

      this.emitEvent({
        type: 'scene_complete',
        timestamp: Date.now(),
      }, options);
    } finally {
      this.isPlaying = false;
      this.effects.clearAll();
      stopSpeech();
    }
  }

  /**
   * Execute a single action with optional callbacks
   */
  async executeAction(action: AgentAction, options?: ExecutionOptions): Promise<void> {
    this.emitEvent({
      type: 'action_start',
      action,
      timestamp: Date.now(),
    }, options);

    try {
      switch (action.type) {
        case 'speech':
          await this.executeSpeech(action);
          break;
        case 'spotlight':
        case 'laser':
        case 'highlight':
          // Deprecated: Visual effects are no longer executed.
          break;
        case 'pause':
          await this.executePause(action);
          break;
        case 'whiteboard_draw':
          // await this.executeWhiteboardDraw(action); // Deprecated
          break;
        case 'whiteboard_text':
          // await this.executeWhiteboardText(action); // Deprecated
          break;
        case 'whiteboard_clear':
          // await this.executeWhiteboardClear(action); // Deprecated
          break;
        case 'tutor_help':
        case 'ask_tutor':
          if (options?.onTutorHelp) {
            options.onTutorHelp();
          }
          break;
        default:
          // Handle unknown action types silently
          break;
      }
    } finally {
      this.emitEvent({
        type: 'action_end',
        action,
        timestamp: Date.now(),
      }, options);
    }
  }

  private async executeActionInternal(action: AgentAction): Promise<void> {
    switch (action.type) {
      case 'speech':
        return this.executeSpeech(action);
      case 'spotlight':
      case 'laser':
      case 'highlight':
        // Deprecated
        return Promise.resolve();
      case 'pause':
        return this.executePause(action);
      case 'whiteboard_draw':
      case 'whiteboard_text':
      case 'whiteboard_clear':
        // Whiteboard actions persisted to canvas/store
        return Promise.resolve();
    }
  }

  private async executeSpeech(action: AgentAction): Promise<void> {
    if (!action.content) return;
    try {
      await speak(action.content, 'alloy');
    } catch (error) {
      console.error('Speech execution error:', error);
    }
  }

  private async executeSpotlight(action: AgentAction): Promise<void> {
    if (action.elementId) {
      this.effects.showSpotlight(action.elementId);
      if (action.duration) {
        await this.delay(action.duration);
        this.effects.hideSpotlight();
      }
    }
  }

  private async executeLaser(action: AgentAction): Promise<void> {
    if (action.position) {
      this.effects.showLaser(
        action.position.x,
        action.position.y,
        0,
        action.color
      );
      if (action.duration) {
        await this.delay(action.duration);
        this.effects.hideLaser();
      }
    }
  }

  private async executeHighlight(action: AgentAction): Promise<void> {
    if (action.elementId) {
      this.effects.highlight(action.elementId);
      if (action.duration) {
        await this.delay(action.duration);
        this.effects.unhighlight(action.elementId);
      }
    }
  }

  private async executePause(action: AgentAction): Promise<void> {
    if (action.duration) {
      await this.delay(action.duration);
    }
  }

  private sortActionsByTiming(actions: AgentAction[]): Array<AgentAction & { delay?: number }> {
    // Generate timing if not specified
    return actions.map((action, index) => ({
      ...action,
      delay: index * 2000, // Default 2 second spacing
    }));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, Math.max(100, ms / (this.options.speedMultiplier || 1)));
      this.currentTimeout = timeout;
    });
  }

  private emitEvent(event: OrchestrationEvent, options?: ExecutionOptions): void {
    if (this.options.onEvent) {
      this.options.onEvent(event);
    }
    if (options?.onEvent) {
      options.onEvent(event);
    }
  }

  stop(): void {
    this.isPlaying = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    stopSpeech();
    this.effects.clearAll();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    stopSpeech();
  }

  resume(): void {
    // Resume would require tracking position - future enhancement
  }
}
