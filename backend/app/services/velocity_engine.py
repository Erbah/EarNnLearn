import math
from datetime import datetime, timedelta
from typing import Dict, List

class VelocityEngine:
    """
    The Velocity Engine calculates the 'Cognitive State' of a learner.
    It uses exponential decay to track knowledge stability and engagement data
    to derive comprehension scores.
    """
    
    @staticmethod
    def calculate_stability(last_reviewed: datetime, difficulty: float = 1.0) -> float:
        """
        Calculates the Stability Index (S) based on the forgetting curve logic:
        S = e^(-t / D)
        t = time since last review (in days)
        D = difficulty of the topic (1.0 = easy, 5.0 = complex)
        """
        if not last_reviewed:
            return 0.0
            
        t = (datetime.now() - last_reviewed).total_seconds() / (24 * 3600) # days
        decay_constant = difficulty * 2.0 # Calibration for educational materials
        
        stability = math.exp(-t / decay_constant)
        return round(stability, 3)

    @staticmethod
    def derive_comprehension(quiz_score: float, time_spent_minutes: float, predicted_time: float) -> float:
        """
        Derives the Comprehension Score (C) based on performance and engagement.
        C = (Score * 0.7) + (EngagementRatio * 0.3)
        """
        engagement_ratio = min(1.0, time_spent_minutes / max(1.0, predicted_time))
        comprehension = (quiz_score * 0.7) + (engagement_ratio * 0.3)
        return round(comprehension, 3)

    @staticmethod
    def calculate_velocity(topics_completed: int, total_time_minutes: float) -> float:
        """
        Calculates Mastery Velocity (V) in topics per hour.
        """
        if total_time_minutes == 0:
            return 0.0
        return round(topics_completed / (total_time_minutes / 60), 2)

    def get_needs_revision_list(self, user_progress: List[Dict]) -> List[str]:
        """
        Identifies topic IDs where stability has dropped below the critical threshold (0.6).
        """
        revision_list = []
        for topic in user_progress:
            stability = self.calculate_stability(topic.get('last_reviewed'), topic.get('difficulty', 1.0))
            if stability < 0.6:
                revision_list.append(topic.get('topic_id'))
        return revision_list
