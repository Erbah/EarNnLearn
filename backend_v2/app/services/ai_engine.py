from sqlalchemy.orm import Session
from app.models.user import User
from app.models.ai import AIUsage, SubjectRoadmap, AILesson
from app.models.wallet import Wallet, WalletTransaction
from app.services.ai_prompts import (
    ROADMAP_PROMPT, 
    LESSON_SECTION_PROMPT, 
    SECTION_INSTRUCTIONS, 
    DEPTH_REINFORCEMENT_PROMPT,
    RETRY_VARIATION_PROMPT,
    CORE_PRINCIPLES_FALLBACK,
    FIRST_LESSON_BOOST_PROMPT,
    WHITEBOARD_PROTOCOL,
    ELITE_DEPTH_RETRY_PROMPT
)
import json
import re
import random
from datetime import datetime
from decimal import Decimal

# Cost constants per 1000 tokens (e.g., matching OpenAI GPT-4o-mini pricing)
COST_PER_1K_TOKENS = Decimal('0.005') 

class AITutorEngine:
    
    @staticmethod
    def bill_usage(db: Session, user_rid: str, feature: str, tokens: int, prompt_data: dict = None) -> bool:
        """
        Calculates the AI token cost and securely deducts it from the user's wallet.
        Returns False if the user lacks the funds to complete the AI request.
        """
        # Calculate exact cost for this translation
        cost = (Decimal(str(tokens)) / Decimal('1000')) * COST_PER_1K_TOKENS
        
        # Free use for infinitesimally small tasks or dev environments
        if cost <= Decimal('0.0000'):
            return True

        wallet = db.query(Wallet).filter(Wallet.user_rid == user_rid).first()
        if not wallet or wallet.balance < cost:
            return False # Payment Required - AI Access Denied
            
        # Deduct Cost
        wallet.balance -= cost
        wallet.withdrawable_balance -= cost
        
        # Log AI explicit transaction
        db.add(WalletTransaction(
            user_rid=user_rid,
            type="AI_USAGE",
            amount=-cost,
            description=f"AI Token Usage: {feature} ({tokens} tokens)"
        ))
        
        # Log AI metric
        db.add(AIUsage(
            user_rid=user_rid,
            feature_used=feature,
            tokens_used=tokens,
            cost=cost,
            prompt_metadata=prompt_data
        ))
        
        db.commit()
        return True

    @staticmethod
    def generate_quiz_prompt(video_title: str, duration: int) -> str:
        """
        Helper to construct the LLM prompt for the Quiz Feature.
        In production, this strings together with `openai` or `anthropic` clients.
        """
        return f"Generate a 5-question multiple choice quiz for the educational video titled '{video_title}'. Make it challenging but fair."

    @staticmethod
    def generate_course_review_prompt(title: str, description: str, category: str, price: float) -> str:
        """
        Constructs a prompt for the AI to review a course submission.
        """
        return (
            f"Review the following course submission for LearNnEarn platform:\n"
            f"Title: {title}\n"
            f"Category: {category}\n"
            f"Price: GHS {price}\n"
            f"Description: {description}\n\n"
            f"Please evaluate the course based on:\n"
            f"1. Clarity and Engagement of the title/description.\n"
            f"2. Pricing appropriateness for the category.\n"
            f"3. Potential value to students.\n\n"
            f"Return your review in JSON format with fields: 'recommendation' (Approve, Reject, or Needs Improvement), "
            f"'health_score' (0-100), and 'suggestions' (list of strings)."
        )

    @staticmethod
    def get_ai_course_review(title: str, description: str, category: str, price: float) -> dict:
        """
        Simulates an AI review of a course submission.
        In production, this would call openai.chat.completions.create(...)
        """
        # Simple heuristic-based mock for demonstration
        health_score = 85
        suggestions = []
        recommendation = "Approve"

        if len(description or "") < 100:
            health_score -= 30
            suggestions.append("The description is too short. Add more details about the learning outcomes.")
            recommendation = "Needs Improvement"
        
        if price > 500 and category == "Beginner":
            health_score -= 20
            suggestions.append("The price seems high for a beginner-level course. Consider a more competitive entry point.")
            recommendation = "Needs Improvement"

        if "spam" in (description or "").lower() or "test" in (title or "").lower():
            health_score = 10
            suggestions.append("The content appears to be test data or low quality.")
            recommendation = "Reject"

        if health_score >= 80:
            suggestions.append("Excellent structure and clear value proposition.")

        return {
            "recommendation": recommendation,
            "health_score": health_score,
            "suggestions": suggestions
        }

    @staticmethod
    def get_system_instruction(role: str, topic: str, context: dict = None) -> str:
        """
        Generates the Aria Persona instructions for the AI Tutor.
        Includes guiding phrases, memory-aware tone, and whiteboard protocol.
        """
        user_level = (context or {}).get("understanding_level", "medium")
        student_state = (context or {}).get("student_state", "Normal")
        
        # Consistent Identity Traits (v9)
        persona_base = f"""
# IDENTITY PROTOCOL: ARIA (Visual AI Tutor)

YOU ARE ARIA. YOU ARE NOT A BRANDED BOT. YOU ARE A REAL TUTOR.
IDENTITY TRAITS: Encouraging but precise, highly intelligent, scholarly yet supportive.

## 🗣️ GUIDING PHRASES (USE NATURALLY)
- "Let's break this down together..."
- "Notice what's happening here..."
- "Think of it this way..."

## 🧠 MEMORY-AWARE ADAPTATION:
- Student State: {student_state}
- If 'Struggling': Be more supportive, provide more analogies, slow down.
- If 'Excelling': Be more concise, use advanced terminology, challenge with deep insights.
- **DO NOT** overuse the name "Aria" in every message. Keep it natural.

## 🎨 LIVE WHITEBOARD CAPABILITIES
Whenever visualizing or demonstrating a concept, YOU MUST use the Whiteboard tags.
1. DRAW PATH: `[WHITEBOARD: {{"action": "drawPath", "points": [{{ "x": X, "y": Y }}, ...], "color": "#hex", "width": N, "duration": 300}}]`
2. ADD LABEL: `[WHITEBOARD: {{"action": "addText", "content": "Label", "x": X, "y": Y, "color": "#hex", "fontSize": "size"}}]`
3. RESET BOARD: `[WHITEBOARD: {{"action": "clear"}}]`

- 📏 Specification: 800x600 canvas. Center is (400, 300).
- 🛑 STRICT JSON: No newlines inside [WHITEBOARD: ...]. Close every tag with `}}]`.

## 🧠 TEACHING CONTEXT:
- Role: {role.upper()}
- Current Topic: {topic}
- Student Level: {user_level}
- **Style Preferences**: {(context or {}).get("preferred_style", "Balanced")}
- **Goal**: {(context or {}).get("learning_goal", "General Exploration")}

## 🔬 PERSONALIZATION OVERRIDE (v12):
"""
        preferred_style = (context or {}).get("preferred_style", "Balanced")
        learning_goal = (context or {}).get("learning_goal", "General Exploration")
        is_first_session = (context or {}).get("is_first_session", False)

        if preferred_style == "Practical":
            persona_base += "\n- **PRACTICAL MODE**: Prioritize real-world scenarios. Use fewer abstract definitions. Show HOW it's used before WHY it works."
        elif preferred_style == "Theoretical":
            persona_base += "\n- **THEORETICAL MODE**: Include derivations and deep concept breakdowns. Focus on the core logic and first principles."
        elif preferred_style == "Fast-paced":
            persona_base += "\n- **FAST-PACED MODE**: Maximize density, minimize fluff. Keep explanations extremely concise. Move quickly through simple parts."

        if is_first_session:
            persona_base += "\n- **FIRST SESSION BOOST**: Provide extra encouragement. Use gentler language. Ensure initial exercises are confidence-building and slightly easier."

        persona_base += f"""

## BEHAVIOR PRIORITY:
1. **Direct Action**: DRAW FIRST using whiteboard tags, then explain.
2. **Contextual Awareness**: Reference previous drawings.
3. **Professionalism**: Maintain a scholarly and emotionally supportive tone.
"""
        return persona_base.strip()

    @staticmethod
    def chat(user_message: str, context: dict, history: list = None, user: any = None) -> str:
        """
        The Master AI Chat Engine with History and Flexible Persona.
        Routes requests through LiteLLM with contextual awareness.
        """
        from app.core.config import Settings
        from dotenv import load_dotenv, find_dotenv
        
        # Force reload .env to catch changes during development
        load_dotenv(find_dotenv(), override=True)
        settings = Settings()
        
        topic = context.get("topic", "the current subject")
        role = context.get("tutor_role", "tutor")
        
        # If provider is mock, use the legacy random response system
        if settings.AI_PROVIDER == "mock":
            return AITutorEngine._mock_chat_fallback(user_message, topic, role)

        import litellm
        import os
        try:
            # Configure LiteLLM
            api_keys = {
                "google": settings.GOOGLE_API_KEY,
                "openai": settings.OPENAI_API_KEY,
                "anthropic": settings.ANTHROPIC_API_KEY,
                "deepseek": settings.DEEPSEEK_API_KEY,
            }
            
            model = settings.AI_MODEL
            api_key = api_keys.get(settings.AI_PROVIDER)

            if not api_key:
                return f"[Config Error] API Key for {settings.AI_PROVIDER} is missing."

            # Explicitly set environment variable for LiteLLM
            env_key_map = {
                "google": "GEMINI_API_KEY",
                "openai": "OPENAI_API_KEY",
                "deepseek": "DEEPSEEK_API_KEY",
                "anthropic": "ANTHROPIC_API_KEY"
            }
            if settings.AI_PROVIDER in env_key_map:
                os.environ[env_key_map[settings.AI_PROVIDER]] = api_key

            # ---------------------------------------------------------
            # 1. MESSAGE CONSTRUCTION (Memory Management)
            # ---------------------------------------------------------
            messages = [
                {"role": "system", "content": AITutorEngine.get_system_instruction(role, topic, context)}
            ]

            # 2. HYBRID MEMORY: Inject historical messages
            # For this version, we use a window of the last 15 messages (handled in education.py)
            if history:
                for msg in history:
                    db_role = msg.get("role", "user")
                    # Map teacher/tutor/peer back to assistant for LLM
                    llm_role = "assistant" if db_role != "user" else "user"
                    messages.append({
                        "role": llm_role,
                        "content": msg.get("content", "")
                    })

            # 3. Add latest user query
            # (Note: we avoid duplicates if the latest query was already in the history tail)
            if not history or history[-1].get("content") != user_message:
                messages.append({"role": "user", "content": user_message})

            # 4. AGGRESSIVE CONTEXT-CORRECTION (Overrides previous refusals)
            # Inject a mandatory visual capabilities reminder as the final user-side injection
            # This forces the model to ignore its previous "I can't draw" statements.
            messages.append({
                "role": "user", 
                "content": "(INTERNAL SYSTEM NOTE: You have full access to the [WHITEBOARD: ...] commands. Even if you previously said you couldn't draw, you MUST DRAW now if a visual helps. Do not apologize for being text-only.)"
            })

            # Execute the call with a safe token limit for diagrams
            print(f"DEBUG: Calling Master AI Engine with model={model} and {len(messages)} messages")
            response = litellm.completion(
                model=model, 
                messages=messages,
                max_tokens=3000 # Increased headroom for detailed chat answers
            )
            
            return response.choices[0].message.content

        except Exception as e:
            error_msg = f"AI Provider Error ({settings.AI_PROVIDER}): {str(e)}"
            print(error_msg)
            return f"DEBUG: {error_msg}\n\nFALLBACK: {AITutorEngine._mock_chat_fallback(user_message, topic, role)}"

    @staticmethod
    def _mock_chat_fallback(user_message: str, topic: str, role: str) -> str:
        """
        Original hardcoded response engine used as a fallback.
        """
        responses = {
            "teacher": [
                f"That's a great question about {topic}! Fundamental to understanding this is...",
                f"As we've discussed, {topic} is essential because it allows us to...",
                f"To master {topic}, you should focus on how the core principles relate to your user objectives."
            ],
            "tutor": [
                f"I can definitely help you with {topic}. What part are you finding most challenging?",
                f"Let's break down {topic} together. Think of it as a set of modular blocks...",
                f"Great point! If you look at it from a practical perspective, {topic} becomes much easier."
            ],
            "peer": [
                f"I was just thinking about {topic} too! I think it's really cool how it...",
                f"Yeah, {topic} can be tricky at first, but once you get the hang of it, it's awesome.",
                f"Have you tried applying {topic} to the exercise we just did? It really helped me."
            ]
        }
        
        import random
        base_responses = responses.get(role, responses["tutor"])
        selected = random.choice(base_responses)
        
        if "?" in user_message:
            return f"{selected} Specifically regarding your question, I'd say that {topic} helps by providing a structured approach."
        
        return f"{selected} I'm really impressed with your progress in {topic} so far!"

    # ═══════════════════════════════════════════
    #  DEEP LEARNING TUTOR ENGINE - NEW METHODS
    # ═══════════════════════════════════════════

    @staticmethod
    def generate_roadmap(db: Session, user_rid: str, subject: str) -> dict:
        """
        Phase 1: Generates a complete structured curriculum for a subject.
        Persists it to the subject_roadmaps table.
        """
        from app.core.config import Settings
        settings = Settings()
        import litellm
        import os
        # Ensure LiteLLM can find the API key
        if settings.AI_PROVIDER == "google" and settings.GOOGLE_API_KEY:
            os.environ["GEMINI_API_KEY"] = settings.GOOGLE_API_KEY

        try:
            # Check for existing valid roadmap with same subject
            existing = db.query(SubjectRoadmap).filter(
                SubjectRoadmap.user_rid == user_rid,
                SubjectRoadmap.subject.ilike(subject)
            ).first()
            if existing:
                return existing.roadmap_data

            prompt = ROADMAP_PROMPT.format(subject=subject)

            response = litellm.completion(
                model=settings.AI_MODEL,
                messages=[{"role": "user", "content": prompt}]
            )
            raw_text = response.choices[0].message.content
            # Extract JSON from response (handle markdown code blocks)
            import re as _re
            json_match = _re.search(r'```(?:json)?\s*([\s\S]*?)```', raw_text)
            if json_match:
                raw_text = json_match.group(1).strip()
            roadmap_json = json.loads(raw_text)
            
            # --- 🚨 Hardening: Dependency Graph Generation ---
            # If the AI didn't provide a graph, generate a default linear one
            if "dependency_graph" not in roadmap_json:
                graph = {}
                flat_topics = []
                for unit in roadmap_json.get("units", []):
                    for topic in unit.get("topics", []):
                        flat_topics.append(topic["id"])
                
                for i, tid in enumerate(flat_topics):
                    graph[tid] = [flat_topics[i-1]] if i > 0 else []
                roadmap_json["dependency_graph"] = graph

            # 3. Persist
            new_roadmap = SubjectRoadmap(
                user_rid=user_rid,
                subject=subject,
                roadmap_data=roadmap_json,
                dependency_graph=roadmap_json.get("dependency_graph", {})
            )
            db.add(new_roadmap)
            db.commit()
            db.refresh(new_roadmap)
            
            return roadmap_json
        except Exception as e:
            print(f"Roadmap Generation Error: {str(e)}")
            return {"error": "Failed to generate roadmap", "details": str(e)}

    @staticmethod
    def validate_depth(section_name: str, content: str) -> list:
        """
        Strict Elite Depth Enforcement validator (v15).
        Returns a list of deficiencies. Empty list means validation passed.
        """
        deficiencies = []
        word_count = len(content.split())
        lower_content = content.lower()
        
        # 1. Broad Structural Checks (Textbook Standard)
        min_words = 250 if section_name not in ["summary", "introduction"] else 120
        if word_count < min_words:
            deficiencies.append(f"Content is thin ({word_count} words). Need at least {min_words} for elite depth.")

        # 2. Semantic Integrity Checks (v15 Refinements)
        # Check for Step-by-Step Logic
        has_logic_steps = bool(re.search(r"(\d\.\s|Step\s\d|Firstly|Secondly|Finally|Next,)", content))
        if not has_logic_steps and section_name in ["core_concepts", "technical_detail"]:
            deficiencies.append("Missing a step-by-step logical sequence or thinking chain.")

        # Check for Numerical/Logic Evidence
        has_numerical_evidence = bool(re.search(r"(\d+|[\+\-\*\/=]|π|Σ|λ)", content))
        if not has_numerical_evidence and section_name in ["technical_detail", "examples"]:
            deficiencies.append("Lacks concrete numerical data points or data-backed logic.")

        # Check for Mastery Takeaway
        has_takeaway = any(k in lower_content for k in ["takeaway", "golden rule", "key lesson", "mastery point"])
        if not has_takeaway and section_name == "summary":
            deficiencies.append("Missing a defined 'Mastery Takeaway' or 'Golden Rule'.")

        # 3. Section-Specific Requirements
        if section_name == "introduction":
            analogy_keywords = ["think of", "like a", "imagine", "as if", "similar to", "analogy"]
            if not any(k in lower_content for k in analogy_keywords):
                deficiencies.append("Missing a real-world analogy to ground the concept.")

        if section_name == "examples":
            example_count = len(re.findall(r"(?:Example|Case Study|Scenario)\s+\d*:", content, re.IGNORECASE))
            if example_count < 2:
                deficiencies.append(f"Found only {example_count} worked example(s). Minimum required: 2.")

        if section_name == "exercises":
            if "[QUIZ_JSON:" not in content:
                deficiencies.append("Missing interactive quiz data ([QUIZ_JSON: ...]).")
            
            # Pattern-based Mistake Check
            if "mistake" not in lower_content or "common error" not in lower_content:
                deficiencies.append("Exercises lack 'Common Mistake Pattern' context.")

        return deficiencies

    @staticmethod
    def get_aria_feedback(correct: bool, topic: str) -> str:
        """
        Varied Feedback Pool (Aria Persona).
        Includes 'Near-miss' and coaching tones.
        """
        import random
        pools = {
            "correct": [
                "Spot on! You nailed the core logic there.",
                "Exactly. You've clearly grasped the relationship in this topic.",
                "Precisely! Let's carry this momentum forward.",
                "Excellent work. Notice how cleanly that principle applies."
            ],
            "incorrect": [
                "Not quite. Let's look at it from another angle together.",
                "A common misconception, but here's the catch...",
                "Interesting thought, but let's re-examine that first step.",
                "Not this time. Don't worry—most students find this point tricky."
            ],
            "near_miss": [
                "You're very close—just one small detail to polish.",
                "A strong attempt! Notice one subtle point you missed there.",
                "Almost perfect. Check the second step once more."
            ]
        }
        return random.choice(pools["correct"] if correct else pools["incorrect"])

    @staticmethod
    def parse_quiz(content: str) -> list:
        """Extracts JSON quiz from [QUIZ_JSON: ...] marker."""
        import re
        import json
        pattern = r"\[QUIZ_JSON:\s*(.*?)\]"
        match = re.search(pattern, content, re.DOTALL)
        if match:
            try:
                raw = match.group(1).strip()
                return json.loads(raw)
            except Exception as e:
                print(f"DEBUG: Quiz Parsing Failed: {str(e)}")
        return []

    @staticmethod
    def split_micro_scenes(content: str) -> list:
        """
        Refined Header-Based Segmentation (v16).
        Parses the Elite Completion Protocol structure (Title, Explanation, etc.)
        and enforces strict sectional integrity.
        """
        import re
        
        # Strict mapping of headers to semantic types
        header_map = {
            "Title": "title",
            "Explanation": "explanation",
            "Deep Dive": "deep_dive",
            "Examples": "examples",
            "Key Takeaways": "key_takeaways",
            "Bridge to Next Section": "bridge"
        }
        
        expected_headers = list(header_map.keys())
        
        scenes = []
        
        # 1. Strict Regex Splitting
        # We search for ## Header at the start of a line
        for header, semantic_type in header_map.items():
            pattern = fr"^## {re.escape(header)}\s*([\s\S]*?)(?=\n## |$)"
            match = re.search(pattern, content, re.MULTILINE)
            
            if match:
                body = match.group(1).strip()
                if body:
                    scenes.append({
                        "title": header,
                        "semantic_type": semantic_type,
                        "content": body
                    })
        
        # 2. Structural Integrity & Order Enforcement
        # If we didn't find at least 5 of the 6 sections, we consider the structure compromised.
        is_valid = len(scenes) >= 5
        
        if not is_valid:
            print(f"DEBUG: Elite Structure Compromised ({len(scenes)}/6). Triggering Fallback.")
            # Fallback: Render as a single unified scene to prevent data loss
            return [{
                "title": "Lesson Content",
                "semantic_type": "explanation",
                "content": content
            }]
        return scenes

    @staticmethod
    def parse_whiteboard(content: str, lesson_id: str = "unknown", scene_idx: int = 0) -> tuple:
        """
        Hybrid Parser (Hardened v12): Extracts [WHITEBOARD: ...] markers and returns (clean_text, actions_list).
        Ensures system tags are NEVER visible to the user even if JSON is malformed.
        """
        import re
        import json
        actions = []
        # Steel-Plated Whiteboard Strip (v15) - Bracket Counting Logic
        # Handles nested arrays (like points: [{x,y}]) which trip up simple regex.

        clean_text = content
        start_idx = 0
        while True:
            start_idx = clean_text.find("[WHITEBOARD:")
            if start_idx == -1:
                break
            
            bracket_count = 0
            brace_count = 0
            end_idx = -1
            for i in range(start_idx, len(clean_text)):
                if clean_text[i] == "[":
                    bracket_count += 1
                elif clean_text[i] == "]":
                    bracket_count -= 1
                elif clean_text[i] == "{":
                    brace_count += 1
                elif clean_text[i] == "}":
                    brace_count -= 1
                
                # A whiteboard tag is fully closed when its outer bracket is closed
                # AND all inner JSON braces and arrays are closed.
                if bracket_count == 0 and brace_count == 0 and i > start_idx + 12:
                    end_idx = i
                    break
            
            if end_idx != -1:
                raw_tag = clean_text[start_idx:end_idx + 1]
                # Extract JSON from the tag
                try:
                    inner_match = re.search(r"({.*})", raw_tag, re.S)
                    if inner_match:
                        raw_json = inner_match.group(1).strip()
                        action_data = json.loads(raw_json)
                        action_data["delay"] = len(actions) * 2000 
                        actions.append(action_data)
                except Exception as e:
                    print(f"CLEANUP EVENT: Failed to parse whiteboard JSON in Lesson {lesson_id}, Scene {scene_idx}.")
                    print(f"REMOVED ARTIFACT: {raw_tag[:100]}... [Error: {str(e)}]")
                
                # Strip the tag from the text
                clean_text = clean_text[:start_idx] + clean_text[end_idx + 1:]
            else:
                # Malformed/Truncated tag - strip to end
                clean_text = clean_text[:start_idx]
                break


        return clean_text.strip(), actions


    @classmethod
    def generate_lesson_chapter(cls, db: Session, user_rid: str, topic: str, section_key: str, mode: str = "normal", retry_count: int = 0, deficiencies: list = None) -> list:
        """
        Generates a modular chapter of a lesson.
        Aria Persona (v9): Handles Normal, Review, and Challenge Modes.
        Includes performance logging and recursive validation logic.
        """
        from app.core.config import Settings
        from app.models.ai import LessonProgress
        from app.models.monitoring import AIPerformanceLog
        import time
        import litellm
        import re
        import json
        import os
        
        settings = Settings()
        # Ensure LiteLLM can find the API key
        if settings.AI_PROVIDER == "google" and settings.GOOGLE_API_KEY:
            os.environ["GEMINI_API_KEY"] = settings.GOOGLE_API_KEY
        start_time = time.time()
        perf_log = AIPerformanceLog(
            user_rid=user_rid,
            operation_type="LESSON_CHAPTER",
            subject="AI Tutor", # Could be passed in
            topic=topic,
            operation_metadata={"section": section_key, "mode": mode, "retry": retry_count},
            model_name=settings.AI_MODEL,
            provider="LiteLLM"
        )

        try:
            # 1. Fetch Student Context (Adaptive Layer)
            user = db.query(User).filter(User.rid == user_rid).first()
            if not user:
                 raise ValueError(f"User not found: {user_rid}")
            
            learning_goal = getattr(user, "learning_goal", "General Exploration")
            preferred_style = getattr(user, "preferred_style", "Balanced")

            progress = db.query(LessonProgress).filter(
                LessonProgress.user_rid == user_rid,
                LessonProgress.lesson_id.ilike(f"%{topic}%")
            ).first()
            
            student_state = "Normal"
            if progress:
                if progress.exercise_score and progress.exercise_score < 60:
                    student_state = "Struggling"
                elif progress.exercise_score and progress.exercise_score > 85:
                    student_state = "Excelling"

            # Check if this is the first lesson ever (First Session Boost)
            lesson_count = db.query(AILesson).filter(AILesson.creator_rid == user_rid).count()
            is_first_session = (lesson_count <= 1)

            # 2. Logic Refinement: Mode Adaptation
            diff_constraint = "1 Easy, 1 Medium, 1 Hard."
            reinf_instr = ""
            
            if mode == "review":
                reinf_instr = "\n🚨 REVIEW MODE: Focus on key takeaways and summarizing concepts already learned."
            elif mode == "challenge":
                reinf_instr = "\n🚨 CHALLENGE MODE: Higher cognitive load. Use advanced questions and less scaffolding."
                diff_constraint = "3 Hard questions."

            section_name = section_key.replace("_", " ").title()
            instr = SECTION_INSTRUCTIONS.get(section_key, "Provide detailed content.")
            
            prompt = LESSON_SECTION_PROMPT.format(
                topic=topic,
                section_name=section_name,
                section_instructions=instr,
                student_state=student_state,
                learning_goal=learning_goal,
                preferred_style=preferred_style,
                difficulty_constraint=diff_constraint,
                reinforcement_instructions=reinf_instr,
                whiteboard_protocol=WHITEBOARD_PROTOCOL
            )

            # Pass full context to Persona Engine
            system_context = {
                "understanding_level": student_state,
                "student_state": student_state,
                "learning_goal": learning_goal,
                "preferred_style": preferred_style,
                "is_first_session": is_first_session
            }

            # 3. AI Execution
            retry_feedback = ""
            if deficiencies and retry_count > 0:
                retry_feedback = f"\n\n🚨 PREVIOUS ATTEMPT FAILED QUALITY CHECKS:\nDeficiencies: " + ", ".join(deficiencies)

            system_instruction = cls.get_system_instruction(role="AI Tutor", topic=topic, context=system_context)

            response = litellm.completion(
                model=settings.AI_MODEL,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt + retry_feedback}
                ],
                max_tokens=4000 # Elite Depth headroom
            )
            raw_content = response.choices[0].message.content

            # --- 🛑 SELF-HEALING [CONTINUE] LOOP (v17) ---
            continuation_count = 0
            while "[CONTINUE]" in raw_content and continuation_count < 3:
                print(f"DEBUG: [CONTINUE] detected (Attempt {continuation_count+1}). Self-healing chunk merge...")
                followup_messages = [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt + retry_feedback},
                    {"role": "assistant", "content": raw_content},
                    {"role": "user", "content": "Please continue from exactly where you left off. Do not repeat headers or preamble. Complete the remaining sections of the Elite Protocol."}
                ]
                continuation = litellm.completion(
                    model=settings.AI_MODEL,
                    messages=followup_messages,
                    max_tokens=2500
                )
                raw_content = raw_content.replace("[CONTINUE]", "").strip() + "\n\n" + continuation.choices[0].message.content.strip()
                continuation_count += 1
            
            # 4. Performance Logging & Categorization (v14)
            latency_ms = int((time.time() - start_time) * 1000)
            perf_log.latency_ms = latency_ms
            
            # Actionable Categorization
            if latency_ms < 5000:
                perf_log.latency_category = "Normal"
            elif latency_ms < 8000:
                perf_log.latency_category = "Warning"
            elif latency_ms < 12000:
                perf_log.latency_category = "Critical"
            else:
                perf_log.latency_category = "Failure Risk"
                
            perf_log.prompt_tokens = response.usage.prompt_tokens
            perf_log.completion_tokens = response.usage.completion_tokens
            perf_log.total_tokens = response.usage.total_tokens
            perf_log.success = True

            # 5. Pipeline Logic (Validation -> Parsing -> Scene Splitting)
            new_deficiencies = cls.validate_depth(section_key, raw_content)
            if new_deficiencies and retry_count < 2:
                # ELITE RETRY LOGIC (v15)
                if retry_count == 1:
                    # Final attempt - Use strict elite prompt
                    variation_instr = ELITE_DEPTH_RETRY_PROMPT.format(
                        deficiencies="\n- ".join(new_deficiencies)
                    )
                else:
                    # First retry - Standard variability
                    retry_style = "supportive"
                    retry_focus = "concept analogies"
                    variation_instr = RETRY_VARIATION_PROMPT.format(
                        topic=topic,
                        retry_style=retry_style,
                        retry_focus=retry_focus,
                        style_adaptation_instructions="Simplify terminology even further."
                    )
                
                perf_log.success = False
                perf_log.operation_metadata = {"deficiencies": new_deficiencies}
                db.add(perf_log)
                db.commit()

                return cls.generate_lesson_chapter(
                    db, user_rid, topic, section_key, mode, 
                    retry_count + 1, deficiencies=new_deficiencies
                )
            
            # --- 🛡️ Final Quality Check vs Fallback ---
            if not raw_content or len(raw_content) < 50:
                 raise ValueError("AI returned empty or insufficient content.")

            quiz_questions = cls.parse_quiz(raw_content)
            clean_raw = re.sub(r"\[QUIZ_JSON:.*?\]", "", raw_content, flags=re.DOTALL).strip()
            raw_scenes = cls.split_micro_scenes(clean_raw)
            final_scenes = []
            
            for i, rs in enumerate(raw_scenes):
                text, actions = cls.parse_whiteboard(rs["content"], lesson_id=topic, scene_idx=i)
                scene_type = "text_explanation"
                if section_key == "exercises": scene_type = "interactive"
                elif actions: scene_type = "whiteboard"
                
                final_scenes.append({
                    "id": f"{section_key}_{i}",
                    "type": scene_type,
                    "semantic_type": rs.get("semantic_type", "explanation"),
                    "title": rs["title"] or section_name,
                    "content": text,
                    "actions": actions,
                    "quiz_questions": quiz_questions if i == len(raw_scenes) - 1 else []
                })
            
            db.add(perf_log)
            db.commit()
            return final_scenes
            
        except Exception as e:
            # --- 🛡️ CORE PRINCIPLES FALLBACK (v14) ---
            import traceback
            print(f"DEBUG: Critical Failure in Lesson Gen: {str(e)}")
            traceback.print_exc()
            perf_log.success = False
            perf_log.failure_reason = str(e)
            perf_log.latency_category = "Failure"
            db.add(perf_log)
            db.commit()
            
            # Use Fallback Template to avoid dead ends
            fallback_content = CORE_PRINCIPLES_FALLBACK.format(
                topic=topic,
                concept_summary=f"Let's focus on the essentials of {topic}. At its heart, this topic is about handling complex structures with ease.",
                simple_example=f"Think of {topic} like a blueprint for building something incredible.",
                fallback_question=f"What is the primary goal of studying {topic}?",
                fallback_options=["Mastering core principles", "Memorizing facts", "Skipping steps"],
                fallback_correct="Mastering core principles",
                fallback_explanation="Focusing on the foundations allows you to tackle more advanced problems later."
            )
            
            return [{
                "id": f"scene_{section_key}_fallback",
                "type": "text_explanation",
                "title": f"Core Principles: {topic}",
                "content": fallback_content,
                "actions": [],
                "quiz_questions": cls.parse_quiz(fallback_content)
            }]

ai_tutor_engine = AITutorEngine()
