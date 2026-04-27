export interface RoadmapTopic {
  id: string;
  title: string;
  description?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_minutes?: number;
}

export interface RoadmapUnit {
  title: string;
  topics: RoadmapTopic[];
}

export interface UnitStat {
  title: string;
  total_topics: number;
  completed_topics: number;
  is_completed: boolean;
}

export interface TopicProgress {
  status: "not_started" | "in_progress" | "completed";
  score?: number;
  verified?: boolean;
}

export interface SubjectRoadmapDetails {
  id: string;
  subject: string;
  roadmap_data: {
    units: RoadmapUnit[];
  };
  progress: Record<string, TopicProgress>;
  unit_stats: UnitStat[];
  dependency_graph: Record<string, string[]>;
  guided_mode: boolean;
  teacher_id?: string;
  overall_progress: number;
  resume_topic_id?: string;
  recommended_topic_id?: string;
  recommendation_reason?: string;
  confidence_basis?: string;
}
