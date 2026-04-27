import logging
import json
from datetime import datetime
from sqlalchemy.orm import Session
from common.models.skill_tree import SkillNode, UserSkill, CareerPath, skill_prerequisites
from common.models.education import AICourse
from common.services.ai_teacher_engine import ai_teacher_engine

logger = logging.getLogger(__name__)

class SkillTreeService:
    """
    Manages the learning graph (Skill Tree) and career path chaining.
    """

    def get_user_tree(self, db: Session, user_rid: str, category: str = None) -> list:
        """
        Retrieves all nodes in the tree, marked with the user's progress.
        """
        try:
            query = db.query(SkillNode)
            if category:
                query = query.filter(SkillNode.category == category)
            
            nodes = query.all()
            user_skills = {s.skill_id: s for s in db.query(UserSkill).filter(UserSkill.user_rid == user_rid).all()}
            
            # Fetch all prerequisites once for efficiency
            all_prereqs = db.query(skill_prerequisites).all()
            prereq_map = {}
            for row in all_prereqs:
                # Row is a KeyedTuple/Tuple depending on engine
                pid, prid = row[0], row[1] 
                if pid not in prereq_map:
                    prereq_map[pid] = []
                prereq_map[pid].append(prid)

            result = []
            for node in nodes:
                status = "locked"
                if node.id in user_skills:
                    status = "mastered" if user_skills[node.id].is_mastered else "unlocked"
                
                # Check if unlockable (all prerequisites mastered)
                if status == "locked":
                    node_prereqs = prereq_map.get(node.id, [])
                    if not node_prereqs:
                        status = "unlocked" # Root nodes are always unlocked
                    else:
                        all_met = True
                        for prid in node_prereqs:
                            if prid not in user_skills or not user_skills[prid].is_mastered:
                                all_met = False
                                break
                        if all_met:
                            status = "unlocked"

                result.append({
                    "id": node.id,
                    "title": node.title,
                    "category": node.category,
                    "status": status,
                    "ui_metadata": node.ui_metadata
                })
            return result
        except Exception as e:
            logger.error(f"Error in get_user_tree: {str(e)}")
            raise

    def generate_career_roadmap(self, db: Session, user_rid: str, goal: str) -> CareerPath:
        """
        AI generates a multi-phase learning journey for a career goal.
        """
        # Simulation: AI Logic chooses courses based on goal
        if "ai engineer" in goal.lower():
            sequence = ["Mathematics for AI", "Python for Data Science", "Machine Learning Foundations"]
        else:
            sequence = [f"Introduction to {goal}", f"Advanced {goal}", f"{goal} Capstone Project"]

        course_ids = []
        for title in sequence:
            # Re-use ai_teacher_engine to generate roadmaps for each
            course = ai_teacher_engine.generate_roadmap(db, user_rid, title)
            course_ids.append(course.id)

        new_path = CareerPath(
            title=goal,
            user_rid=user_rid,
            course_sequence=course_ids
        )
        db.add(new_path)
        db.commit()
        return new_path

    def unlock_node(self, db: Session, user_rid: str, skill_id: str):
        """
        Manually marks a skill as mastered (e.g., after course completion).
        """
        user_skill = db.query(UserSkill).filter(
            UserSkill.user_rid == user_rid, 
            UserSkill.skill_id == skill_id
        ).first()
        
        if not user_skill:
            user_skill = UserSkill(user_rid=user_rid, skill_id=skill_id, is_mastered=True)
            db.add(user_skill)
        else:
            user_skill.is_mastered = True
            
        db.commit()

skill_tree_service = SkillTreeService()
