/**
 * Whiteboard Manager (Advanced Cognition Edition)
 * Manages the state of the interactive visual reasoning layer
 */

export type DrawCommand = 
  | { type: "circle"; x: number; y: number; r: number; color?: string }
  | { type: "line"; from: [number, number]; to: [number, number]; color?: string }
  | { type: "arrow"; from: [number, number]; to: [number, number]; color?: string }
  | { type: "text"; x: number; y: number; value: string; color?: string; fontSize?: string };

export interface WhiteboardElement {
  id: string;
  command: DrawCommand;
  stepIndex: number; // For attention guidance (focus current, dim previous)
}

export interface VisualStep {
  id: string;
  narration?: string;
  commands: DrawCommand[];
  delay?: number;
}

export interface VisualSequence {
  type: "sequence";
  steps: VisualStep[];
}

export interface WhiteboardState {
  elements: WhiteboardElement[];
  sequenceStatus: {
    currentStep: number;
    totalSteps: number;
    label: string;
    isActive: boolean;
  };
}

class WhiteboardManager {
  private state: WhiteboardState = {
    elements: [],
    sequenceStatus: {
      currentStep: 0,
      totalSteps: 0,
      label: "",
      isActive: false,
    },
  };

  private listeners: ((state: WhiteboardState) => void)[] = [];
  private currentSequenceId: string | null = null;
  private isFastForwarding: boolean = false;

  getState(): WhiteboardState {
    return { ...this.state };
  }

  subscribe(listener: (state: WhiteboardState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l({ ...this.state }));
  }

  // Coordinate conversion: 0..1 to 0..1000
  private normalize(val: number): number {
    return Math.max(0, Math.min(1000, val * 1000));
  }

  private normalizeCommand(cmd: DrawCommand): DrawCommand {
    if (cmd.type === "circle") {
      return { ...cmd, x: this.normalize(cmd.x), y: this.normalize(cmd.y), r: this.normalize(cmd.r) };
    }
    if (cmd.type === "line" || cmd.type === "arrow") {
      return { 
        ...cmd, 
        from: [this.normalize(cmd.from[0]), this.normalize(cmd.from[1])],
        to: [this.normalize(cmd.to[0]), this.normalize(cmd.to[1])]
      };
    }
    if (cmd.type === "text") {
      return { ...cmd, x: this.normalize(cmd.x), y: this.normalize(cmd.y) };
    }
    return cmd;
  }

  addElement(cmd: DrawCommand, stepIndex: number) {
    const element: WhiteboardElement = {
      id: Math.random().toString(36).substr(2, 9),
      command: this.normalizeCommand(cmd),
      stepIndex,
    };
    this.state.elements.push(element);
    this.notify();
    return element.id;
  }

  drawPath(
    points: [number, number][],
    color: string = "#06b6d4",
    _width: number = 2,
    _duration: number = 500
  ) {
    for (let i = 0; i < points.length - 1; i++) {
      this.addElement(
        { type: "line", from: points[i], to: points[i + 1], color },
        0
      );
    }
  }

  addText(opts: {
    content: string;
    x: number;
    y: number;
    color?: string;
    fontSize?: string;
  }) {
    this.addElement(
      {
        type: "text",
        x: opts.x,
        y: opts.y,
        value: opts.content,
        color: opts.color,
        fontSize: opts.fontSize,
      },
      0
    );
  }

  clear() {
    this.state.elements = [];
    this.notify();
  }

  // --- 🎨 Legacy Support Methods (v1 compatibility) ---
  
  drawPath(points: [number, number][], color?: string, width?: number, duration?: number) {
    if (!points || points.length < 2) return;
    // Map path to a series of normalized lines
    for (let i = 0; i < points.length - 1; i++) {
      this.addElement({
        type: "line",
        from: points[i],
        to: points[i+1],
        color: color || "#06b6d4"
      }, this.state.elements.length + 1);
    }
  }

  addText(data: { content: string; x: number; y: number; color?: string; fontSize?: string }) {
    this.addElement({
      type: "text",
      x: data.x,
      y: data.y,
      value: data.content,
      color: data.color || "#ffffff",
      fontSize: data.fontSize || "16px"
    }, this.state.elements.length + 1);
  }

  /**
   * 🎬 Visual Sequence Engine (Cognition Protocol v2)
   */
  async runSequence(sequence: VisualSequence) {
    // Interruption logic: fast-forward existing sequence
    if (this.state.sequenceStatus.isActive) {
      this.isFastForwarding = true;
      await new Promise(r => setTimeout(r, 50));
    }

    const seqId = Math.random().toString(36).substr(2, 9);
    this.currentSequenceId = seqId;
    this.isFastForwarding = false;

    // Reset Lab for new sequence
    this.clear();
    
    this.state.sequenceStatus = {
      isActive: true,
      currentStep: 0,
      totalSteps: sequence.steps.length,
      label: "Synthesizing reasoning...",
    };
    this.notify();

    for (let i = 0; i < sequence.steps.length; i++) {
      if (this.currentSequenceId !== seqId && !this.isFastForwarding) break;

      const step = sequence.steps[i];
      this.state.sequenceStatus = {
        ...this.state.sequenceStatus,
        currentStep: i + 1,
        label: step.narration || step.id || `Step ${i + 1}`,
      };
      this.notify();

      // Execute all commands in this step
      for (const cmd of step.commands) {
        this.addElement(cmd, i + 1);
      }

      // Delay between steps (skipped if fast-forwarding)
      if (!this.isFastForwarding && i < sequence.steps.length - 1) {
        await new Promise(r => setTimeout(r, step.delay || 800));
      }
    }

    if (this.currentSequenceId === seqId) {
      this.state.sequenceStatus.isActive = false;
      this.isFastForwarding = false;
      this.notify();
    }
  }
}

export const whiteboardManager = new WhiteboardManager();
