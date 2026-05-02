/**
 * Lesson System Types
 * Core definitions for lessons, scenes, and agent actions.
 */

export type ActionType = 
  | 'speech' 
  | 'spotlight' 
  | 'laser' 
  | 'whiteboard_draw' 
  | 'whiteboard_text'
  | 'whiteboard_clear'
  | 'pause'
  | 'highlight'
  | 'tutor_help'
  | 'ask_tutor';

export interface AgentAction {
  type: ActionType;
  agentRole?: 'teacher' | 'tutor' | 'peer';
  agent_role?: 'teacher' | 'tutor' | 'peer';
  elementId?: string;
  content?: string;
  audioUrl?: string;
  duration?: number;
  delay?: number;
  position?: { x: number; y: number };
  color?: string;
  width?: number;
}

export interface AgentState {
  role: 'teacher' | 'tutor' | 'peer';
  speaking: boolean;
  message: string;
  spotlight?: {
    elementId: string;
    active: boolean;
  };
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'input' | 'multistep';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  hint?: string;
}

export interface LessonSceneWithActions {
  id: string;
  type: 'slide' | 'quiz' | 'interactive' | 'discussion' | 'whiteboard' | 'text_explanation';
  title: string;
  content: string;
  order: number;
  completed: boolean;
  quiz_questions?: QuizQuestion[];
  actions?: AgentAction[];
}
