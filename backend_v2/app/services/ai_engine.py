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
    ELITE_DEPTH_RETRY_PROMPT,
    LESSON_PLAN_PROMPT,
    EXTERNAL_RESOURCES_PROMPT
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
        preferred_style = (context or {}).get("preferred_style", "Balanced")
        learning_goal = (context or {}).get("learning_goal", "General Exploration")
        is_first_session = (context or {}).get("is_first_session", False)
        
        # Consistent Identity Traits (v9)
        persona_base = f"""
# IDENTITY PROTOCOL: AI Tutor

YOU ARE A REAL TUTOR.
IDENTITY TRAITS: Encouraging but precise, highly intelligent, scholarly yet supportive.

## 🗣️ GUIDING PHRASES (USE NATURALLY)
- "Let's break this down together..."
- "Notice what's happening here..."
- "Think of it this way..."

## 🧠 MEMORY-AWARE ADAPTATION:
- Student State: {student_state}
- If 'Struggling': Be more supportive, provide more analogies, slow down.
- If 'Excelling': Be more concise, use advanced terminology, challenge with deep insights.

## 📏 MATH & SYMBOLS (MANDATORY FORMAT)
- Use LaTeX for complex equations: `\[ equation \]` for blocks, `\( equation \)` for inline.
- ALWAYS use `\[ ... \]` for the main formula when asked for an equation.
- Example: `\[ R = \frac{{V}}{{I}} \]`
- **DO NOT** use HTML tags (like <p>, <ul>). Use Standard Markdown (**bold**, *italic*, - lists).
- Keep explanations clear and academically rigorous.

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
- **Style Preferences**: {preferred_style}
- **Goal**: {learning_goal}

## 🔬 PERSONALIZATION OVERRIDE (v12):
"""

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

    @classmethod
    def _get_active_model(cls, db: Session) -> tuple:
        """
        Fetches the active AI provider and model from SystemSettings.
        Falls back to app Settings if not found in DB.
        """
        from app.models.admin import SystemSetting
        from app.core.config import Settings
        settings = Settings()
        
        provider = db.query(SystemSetting).filter(SystemSetting.key == "ai_provider").first()
        model = db.query(SystemSetting).filter(SystemSetting.key == "ai_model").first()
        custom_key = db.query(SystemSetting).filter(SystemSetting.key == "AI_API_KEY").first()
        base_url = db.query(SystemSetting).filter(SystemSetting.key == "ai_base_url").first()
        
        active_provider = provider.value if provider else settings.AI_PROVIDER
        active_model = model.value if model else settings.AI_MODEL
        active_api_key = custom_key.value if custom_key else None
        active_base_url = base_url.value if base_url else None
        
        return active_provider, active_model, active_api_key, active_base_url

    @classmethod
    def chat(cls, user_message: str, context: dict, db: Session, history: list = None, user: any = None) -> str:
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
        
        # 0. Get Active Model from DB
        active_provider, active_model, active_api_key, active_base_url = cls._get_active_model(db)
        
        # If provider is mock, use the legacy random response system
        if active_provider == "mock":
            return cls._mock_chat_fallback(user_message, topic, role)

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
            
            # Use dynamic model
            model = active_model
            # Priority: 1. DB Custom Key, 2. settings.py Key
            api_key = active_api_key or api_keys.get(active_provider)

            # 🛑 Elite: Fallback to environment model if DB model is clearly blank
            if not model or model == "":
                 model = settings.AI_MODEL

            # 🛑 Elite: Handle generic providers (Ollama, DeepSeek, etc.)
            # If the provider is not one of the majors, we assume the model string 
            # contains the provider prefix (e.g., 'ollama/qwen')
            
            if not api_key and active_provider not in ["mock", "google", "openai", "anthropic", "deepseek"]:
                 # Check if we have a generic API key set in env
                 api_key = settings.AI_API_KEY

            # Explicitly set environment variable for LiteLLM
            env_key_map = {
                "google": "GEMINI_API_KEY",
                "openai": "OPENAI_API_KEY",
                "deepseek": "DEEPSEEK_API_KEY",
                "anthropic": "ANTHROPIC_API_KEY"
            }
            if active_provider in env_key_map:
                os.environ[env_key_map[active_provider]] = api_key or ""

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
            print(f"DEBUG: Calling Master AI Engine with model={model} and {len(messages)} messages (BaseURL: {active_base_url})")
            
            # Construct LiteLLM completion args
            completion_args = {
                "model": model,
                "messages": messages,
                "max_tokens": 3000
            }
            if active_base_url:
                completion_args["api_base"] = active_base_url

            response = litellm.completion(**completion_args)
            
            return response.choices[0].message.content

        except Exception as e:
            error_msg = f"AI Provider Error ({active_provider}): {str(e)}"
            print(error_msg)
            return f"DEBUG: {error_msg}\n\nFALLBACK: {cls._mock_chat_fallback(user_message, topic, role)}"

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
    def _get_context_from_source(db: Session, source_id: str, query: str, limit: int = 5) -> str:
        """
        Retrieves relevant text chunks from a knowledge source.
        Uses a simple keyword search since we aren't using a Vector DB yet.
        """
        from app.models.ai import KnowledgeChunk
        from sqlalchemy import or_
        
        if not source_id:
            return ""
            
        # Clean query for search
        keywords = [word.lower() for word in query.split() if len(word) > 3]
        
        query_obj = db.query(KnowledgeChunk).filter(KnowledgeChunk.source_id == source_id)
        
        if keywords:
            # Search for chunks containing any of the keywords
            # We also prioritize chunks found in the first 20 pages if it's a ToC search
            filters = [KnowledgeChunk.content.ilike(f"%{kw}%") for kw in keywords]
            chunks = query_obj.filter(or_(*filters)).order_by(KnowledgeChunk.page_number).limit(limit).all()
        else:
            chunks = []
            
        if not chunks:
            # Fallback: get first chunks (beginning of document)
            chunks = query_obj.order_by(KnowledgeChunk.page_number).limit(limit).all()

        if not chunks:
            return ""
            
        context_str = "\n\n### 📚 SOURCE CONTEXT (PRIORITY INFORMATION)\n"
        context_str += "The following segments are extracted from the user's uploaded material. Prioritize this information for accuracy:\n\n"
        
        for chunk in chunks:
            context_str += f"--- [Page {chunk.page_number}] ---\n"
            context_str += f"{chunk.content}\n\n"
            
        return context_str

    @classmethod
    def generate_roadmap(cls, db: Session, user_rid: str, subject: str, source_id: str = None, timeout: int = 60, force: bool = False, reuse_level: int = 1) -> dict:
        """
        Phase 1: Generates a complete structured curriculum for a subject.
        Persists it to the subject_roadmaps table.
        """
        from app.core.config import Settings
        settings = Settings()
        import litellm
        import os
        # 0. Get Active Model from DB
        active_provider, active_model, active_api_key, active_base_url = cls._get_active_model(db)
        
        # Ensure LiteLLM can find the API key
        env_key_map = {
            "google": "GEMINI_API_KEY",
            "openai": "OPENAI_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY"
        }
        
        if active_provider in env_key_map:
            # Priority: 1. DB Key, 2. ENV Key
            fallback_key = getattr(settings, f"{active_provider.upper()}_API_KEY", None)
            os.environ[env_key_map[active_provider]] = active_api_key or fallback_key or ""

        try:
            # 1. Reuse Logic (Search before Generate)
            if not force and reuse_level > 0:
                # Check for user's own existing roadmap first
                existing = db.query(SubjectRoadmap).filter(
                    SubjectRoadmap.user_rid == user_rid,
                    SubjectRoadmap.subject.ilike(subject)
                ).first()
                if existing:
                    return existing
                
                # Check for high-quality public roadmaps (Global Persistence)
                from app.services.knowledge_service import knowledge_service
                similar = knowledge_service.find_similar_roadmaps(db, subject, limit=1)
                if similar:
                    print(f"DEBUG: [OCE] Reusing existing public roadmap for '{subject}'")
                    # Clone the best match for this user
                    cloned = knowledge_service.clone_roadmap(db, similar[0].id, user_rid)
                    return cloned

            # 2. RAG Context Injection
            source_context = ""
            if source_id:
                # 🚀 PRIORITY: Find Table of Contents for roadmaps
                source_context = cls._get_context_from_source(db, source_id, "Contents Index Chapters Table", limit=25)
                
                # If the ToC search yielded little or nothing, try the subject as well
                if len(source_context) < 1000:
                    extra_context = cls._get_context_from_source(db, source_id, subject, limit=5)
                    if extra_context:
                        source_context += "\n" + extra_context

            # 3. Construct Prompt
            prompt = ROADMAP_PROMPT.format(subject=subject)
            if source_context:
                prompt = source_context + "\n\n" + prompt

            # Construct LiteLLM completion args
            completion_args = {
                "model": active_model,
                "messages": [{"role": "user", "content": prompt}],
                "timeout": timeout,
                "num_retries": 2
            }
            if active_base_url:
                completion_args["api_base"] = active_base_url

            print(f"DEBUG: [OCE] Generating roadmap for '{subject}' (Timeout: {timeout}s, Model: {active_model})")
            response = litellm.completion(**completion_args)
            raw_text = response.choices[0].message.content
            print(f"DEBUG: [OCE] Raw AI Response Length: {len(raw_text) if raw_text else 0}")
            if not raw_text:
                print("ERROR: [OCE] Received empty response from AI.")
                raise ValueError("Empty response from AI")
            
            # Extract JSON from response (handle markdown code blocks)
            import re as _re
            json_match = _re.search(r'```(?:json)?\s*([\s\S]*?)```', raw_text)
            if json_match:
                raw_text = json_match.group(1).strip()
            
            try:
                roadmap_json = json.loads(raw_text)
            except json.JSONDecodeError as e:
                print(f"DEBUG: [OCE] JSON Decode Error: {str(e)}")
                print(f"DEBUG: [OCE] Snippet of failed JSON: {raw_text[:500]}...")
                raise
            
            # --- 🛡️ Elite: Flatten Unit Logic for Robustness (v20: Deep Recursion) ---
            def extract_topics(obj):
                """Recursively find anything that looks like a topic or lesson."""
                topics = []
                if isinstance(obj, dict):
                    # Check if it's a topic (has title but no nested containers)
                    is_container = any(k in obj for k in ["units", "chapters", "lessons", "parts", "topics"])
                    if "title" in obj and not is_container:
                         topics.append({
                            "id": str(obj.get("id") or obj.get("uai") or random.randint(100000, 999999)),
                            "title": str(obj.get("title")),
                            "difficulty": str(obj.get("difficulty", "intermediate"))
                         })
                         return topics
                    
                    # Otherwise, search all values
                    for k, v in obj.items():
                        # Special case: if key is 'topics' or 'lessons' and value is a list of strings
                        if k in ["topics", "lessons", "chapters"] and isinstance(v, list):
                            for item in v:
                                if isinstance(item, str):
                                    topics.append({
                                        "id": str(random.randint(100000, 999999)),
                                        "title": item,
                                        "difficulty": "intermediate"
                                    })
                                else:
                                    topics.extend(extract_topics(item))
                        else:
                            topics.extend(extract_topics(v))
                elif isinstance(obj, list):
                    for item in obj:
                        topics.extend(extract_topics(item))
                return topics

            def find_units(obj):
                """Find all unit-like objects in the hierarchy."""
                units = []
                # Unit synonyms to look for
                unit_keys = ["units", "chapters", "lessons", "parts", "topics", "modules", "sections"]
                
                if isinstance(obj, dict):
                    found_any = False
                    for k in unit_keys:
                        if k in obj and isinstance(obj[k], list) and len(obj[k]) > 0:
                            units.extend(obj[k])
                            found_any = True
                    
                    if not found_any:
                        for v in obj.values():
                            units.extend(find_units(v))
                elif isinstance(obj, list):
                    for item in obj:
                        units.extend(find_units(item))
                return units

            flattened_units = []
            if "section_b" in roadmap_json:
                raw_units = find_units(roadmap_json["section_b"])
                if not raw_units:
                    raw_units = roadmap_json.get("units", [])

                for u in raw_units:
                    if not isinstance(u, dict): continue
                    unit_topics = extract_topics(u)
                    print(f"DEBUG: Unit '{u.get('title')}' found with {len(unit_topics)} topics.")
                    
                    flattened_units.append({
                        "id": str(u.get("id") or u.get("uai") or random.randint(1000, 9999)),
                        "title": str(u.get("title", "Untitled Unit")),
                        "description": str(u.get("description", "")),
                        "topics": unit_topics
                    })

            # --- 🚨 Hardening: Overwrite existing units ---
            flattened_topics_count = sum(len(u.get("topics", [])) for u in flattened_units)
            if flattened_topics_count > 0:
                print(f"DEBUG: [OCE v21] Overwriting units with {flattened_topics_count} extracted topics.")
                roadmap_json["units"] = flattened_units
            else:
                print("DEBUG: [OCE v21] No topics found during recursive extraction. Applying fail-safe.")
                # --- 🛡️ Fail-safe: Foundational Unit ---
                fallback_unit = {
                    "id": str(random.randint(1000, 9999)),
                    "title": "Foundational Principles",
                    "description": f"Core concepts and first principles of {subject}.",
                    "topics": [
                        { "id": "t_fallback_1", "title": f"Introduction to {subject}", "difficulty": "beginner" },
                        { "id": "t_fallback_2", "title": f"Core Mechanics of {subject}", "difficulty": "intermediate" }
                    ]
                }
                roadmap_json["units"] = [fallback_unit]

            # --- 🚨 Hardening: Dependency Graph Generation ---
            # If the AI didn't provide a graph, generate a default linear one
            if "dependency_graph" not in roadmap_json or not roadmap_json["dependency_graph"]:
                graph = {}
                flat_topics = []
                for unit in roadmap_json.get("units", []):
                    for topic in unit.get("topics", []):
                        if "id" in topic:
                            flat_topics.append(topic["id"])
                
                for i, tid in enumerate(flat_topics):
                    graph[tid] = [flat_topics[i-1]] if i > 0 else []
                roadmap_json["dependency_graph"] = graph

            # 3. Persist
            if force:
                existing = db.query(SubjectRoadmap).filter(
                    SubjectRoadmap.user_rid == user_rid,
                    SubjectRoadmap.subject.ilike(subject)
                ).first()
                if existing:
                    from sqlalchemy.orm.attributes import flag_modified
                    existing.roadmap_data = roadmap_json
                    existing.dependency_graph = roadmap_json.get("dependency_graph", {})
                    existing.updated_at = datetime.utcnow()
                    flag_modified(existing, "roadmap_data")
                    db.commit()
                    db.refresh(existing)
                    return existing

            new_roadmap = SubjectRoadmap(
                user_rid=user_rid,
                subject=subject,
                roadmap_data=roadmap_json,
                dependency_graph=roadmap_json.get("dependency_graph", {}),
                difficulty_level=roadmap_json.get("section_a", {}).get("academic_level", "intermediate")
            )
            db.add(new_roadmap)
            db.commit()
            db.refresh(new_roadmap)
            
            return new_roadmap
        except Exception as e:
            print(f"Roadmap Generation Error: {str(e)}")
            
            # --- 🛡️ Elite: Safety Roadmap Fallback (v22) ---
            print(f"CRITICAL: AI Roadmap generation failed for '{subject}'. Triggering Safety Fallback.")
            
            fallback_json = {
                "section_a": {
                    "subject": subject,
                    "academic_level": "Intermediate",
                    "learning_path_style": "Structured Mastery"
                },
                "units": [
                    {
                        "id": "safety_u1",
                        "title": f"Foundations of {subject}",
                        "description": f"Core principles and introductory concepts of {subject}.",
                        "topics": [
                            { "id": "safety_t1", "title": f"Introduction to {subject}", "difficulty": "beginner" },
                            { "id": "safety_t2", "title": f"First Principles of {subject}", "difficulty": "beginner" },
                            { "id": "safety_t3", "title": f"The Evolution of {subject}", "difficulty": "intermediate" }
                        ]
                    },
                    {
                        "id": "safety_u2",
                        "title": f"Mastering {subject} Mechanics",
                        "description": f"Diving deeper into the operational logic and advanced frameworks of {subject}.",
                        "topics": [
                            { "id": "safety_t4", "title": f"Core Mechanics Breakdown", "difficulty": "intermediate" },
                            { "id": "safety_t5", "title": f"Advanced {subject} Strategies", "difficulty": "advanced" },
                            { "id": "safety_t6", "title": f"Practical Application & Synthesis", "difficulty": "advanced" }
                        ]
                    }
                ],
                "dependency_graph": {
                    "safety_t2": ["safety_t1"],
                    "safety_t3": ["safety_t2"],
                    "safety_t4": ["safety_t3"],
                    "safety_t5": ["safety_t4"],
                    "safety_t6": ["safety_t5"]
                }
            }
            
            # Check for existing valid roadmap with same subject before creating a new one
            existing = db.query(SubjectRoadmap).filter(
                SubjectRoadmap.user_rid == user_rid,
                SubjectRoadmap.subject.ilike(subject)
            ).first()
            
            if existing:
                existing.roadmap_data = fallback_json
                existing.dependency_graph = fallback_json["dependency_graph"]
                db.commit()
                db.refresh(existing)
                return existing

            new_roadmap = SubjectRoadmap(
                user_rid=user_rid,
                subject=subject,
                roadmap_data=fallback_json,
                dependency_graph=fallback_json["dependency_graph"],
                difficulty_level="Intermediate"
            )
            db.add(new_roadmap)
            db.commit()
            db.refresh(new_roadmap)
            return new_roadmap

    @classmethod
    def generate_lesson_plan(cls, db: Session, topic: str, source_id: str = None, timeout: int = 60) -> list:
        """
        Phase 2: Generates a dynamic lesson plan (outline) for a specific topic.
        """
        active_provider, active_model, active_api_key, active_base_url = cls._get_active_model(db)
        import litellm
        
        source_context = ""
        if source_id:
            source_context = cls._get_context_from_source(db, source_id, topic, limit=10)

        prompt = LESSON_PLAN_PROMPT.format(topic=topic)
        if source_context:
            prompt = source_context + "\n\n" + prompt

        try:
            completion_args = {
                "model": active_model,
                "messages": [{"role": "user", "content": prompt}],
                "timeout": timeout
            }
            if active_base_url:
                completion_args["api_base"] = active_base_url

            response = litellm.completion(**completion_args)
            raw_text = response.choices[0].message.content
            
            # Extract JSON
            import re as _re
            json_match = _re.search(r'```(?:json)?\s*([\s\S]*?)```', raw_text)
            if json_match:
                raw_text = json_match.group(1).strip()
            
            plan_data = json.loads(raw_text)
            return plan_data.get("plan", [])
        except Exception as e:
            print(f"Lesson Planning Error: {str(e)}")
            # Fallback to standard structure
            return [
                { "key": "introduction", "title": f"The Foundations of {topic}", "instructions": "Focus on the 'Big Picture' hook and real-world significance." },
                { "key": "core_concepts", "title": "First Principles Breakdown", "instructions": "Break down the core logic and underlying mechanics." },
                { "key": "technical_detail", "title": "Advanced Technical Insight", "instructions": "Deep dive into the math or complex logic." },
                { "key": "examples", "title": "Practical Application", "instructions": "Apply the concepts to real-world scenarios." },
                { "key": "exercises", "title": "Interactive Mastery Challenge", "instructions": "Test understanding with progressive exercises." },
                { "key": "summary", "title": "Final Synthesis", "instructions": "Summarize the key takeaways." }
            ]

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
    def get_tutor_feedback(correct: bool, topic: str) -> str:
        """
        Varied Feedback Pool (Tutor Persona).
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
    def _infer_semantic_type(title: str, index: int, total: int) -> str:
        """
        Heuristic to map dynamic headers to semantic types for UI styling.
        """
        t = title.lower()
        if index == 0: return "title"
        if index == total - 1: return "bridge"
        
        if any(k in t for k in ["takeaway", "summary", "point", "conclusion", "rule", "mastery"]):
            return "key_takeaways"
        if any(k in t for k in ["example", "case", "scenario", "practice", "demo"]):
            return "examples"
        if any(k in t for k in ["deep", "dive", "technical", "detail", "derivation", "proof", "math", "rigor"]):
            return "deep_dive"
        if any(k in t for k in ["logic", "why", "intuition", "principles", "concept", "mechanics"]):
            return "explanation"
            
        # Default based on position
        if index == 1: return "explanation"
        if index == total - 2: return "key_takeaways"
        return "explanation"

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
        Dynamic Header-Based Segmentation (v17).
        Parses any ## Header and splits content into logical scenes.
        """
        import re
        
        # 1. Find all ## Headers
        header_patterns = list(re.finditer(fr"^##\s*(.*?)$", content, re.MULTILINE))
        
        if not header_patterns:
            print("DEBUG: No headers found in lesson content. Triggering fallback.")
            return [{
                "title": "Lesson Content",
                "semantic_type": "explanation",
                "content": content
            }]

        scenes = []
        for i in range(len(header_patterns)):
            title = header_patterns[i].group(1).strip()
            start = header_patterns[i].end()
            next_start = header_patterns[i+1].start() if i + 1 < len(header_patterns) else len(content)
            
            body = content[start:next_start].strip()
            
            if body:
                scenes.append({
                    "title": title,
                    "semantic_type": AITutorEngine._infer_semantic_type(title, i, len(header_patterns)),
                    "content": body
                })
        
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
    def generate_lesson_chapter(cls, db: Session, user_rid: str, topic: str, section_key: str, custom_instructions: str = None, section_title: str = None, difficulty: str = "beginner", education_level: str = "Self-Learning", learner_goal: str = "General Mastery", style: str = "balanced", mode: str = "normal", retry_count: int = 0, deficiencies: list = None, uai: str = None, source_id: str = None, timeout: int = 60) -> list:
        """
        Generates a modular chapter of a lesson using the OCE (Omni-Curriculum Engine) Protocol.
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
        # 0. Get Active Model from DB
        active_provider, active_model, active_api_key, active_base_url = cls._get_active_model(db)

        # Ensure LiteLLM can find the API key
        env_key_map = {
            "google": "GEMINI_API_KEY",
            "openai": "OPENAI_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY"
        }
        
        if active_provider in env_key_map:
            # Priority: 1. DB Key, 2. Settings Key
            fallback_key = getattr(settings, f"{active_provider.upper()}_API_KEY", None)
            os.environ[env_key_map[active_provider]] = active_api_key or fallback_key or ""
        start_time = time.time()
        perf_log = AIPerformanceLog(
            user_rid=user_rid,
            operation_type="LESSON_CHAPTER",
            subject="AI Tutor", # Could be passed in
            topic=topic,
            operation_metadata={"section": section_key, "mode": mode, "retry": retry_count},
            model_name=active_model,
            provider=active_provider
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

            section_name = section_title or section_key.replace("_", " ").title()
            instr = custom_instructions or SECTION_INSTRUCTIONS.get(section_key, "Provide detailed content.")
            
            # 2. RAG Context Injection
            source_context = ""
            if source_id:
                # Use module/chapter name as query for RAG
                source_context = cls._get_context_from_source(db, source_id, section_name, limit=5)

            # 3. Prompt Construction
            prompt = LESSON_SECTION_PROMPT.format(
                topic=topic,
                section_name=section_name,
                section_instructions=instr,
                learning_goal=learner_goal,
                education_level=education_level,
                module_id=uai or "N/A",
                whiteboard_protocol=WHITEBOARD_PROTOCOL
            )
            
            if source_context:
                prompt = source_context + "\n\n" + prompt

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

            # Construct LiteLLM completion args
            completion_args = {
                "model": active_model,
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt + retry_feedback}
                ],
                "max_tokens": 4000,
                "timeout": timeout
            }
            if active_base_url:
                completion_args["api_base"] = active_base_url

            response = litellm.completion(**completion_args)
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
                    model=active_model,
                    messages=followup_messages,
                    max_tokens=2500,
                    timeout=timeout
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
                try:
                    db.add(perf_log)
                    db.flush()
                except Exception as log_err:
                    print(f"WARNING: Performance log failed (recursive): {log_err}")
                    db.rollback()

                return cls.generate_lesson_chapter(
                    db, user_rid, topic, section_key, 
                    custom_instructions=custom_instructions,
                    section_title=section_title,
                    difficulty=difficulty,
                    education_level=education_level,
                    learner_goal=learner_goal,
                    style=style,
                    mode=mode, 
                    retry_count=retry_count + 1, 
                    deficiencies=new_deficiencies,
                    uai=uai,
                    timeout=timeout
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
                    "quiz_questions": quiz_questions if i == len(raw_scenes) - 1 else [],
                    "section_key": section_key
                })
            
            try:
                db.add(perf_log)
                db.flush()
            except Exception as log_err:
                print(f"WARNING: Performance log failed (final): {log_err}")
                db.rollback()
            return final_scenes
            
        except Exception as e:
            # --- 🛡️ CORE PRINCIPLES FALLBACK (v14) ---
            import traceback
            print(f"DEBUG: Critical Failure in Lesson Gen: {str(e)}")
            traceback.print_exc()
            perf_log.success = False
            perf_log.failure_reason = str(e)
            perf_log.latency_category = "Failure"
            try:
                db.add(perf_log)
                db.flush()
            except Exception as log_err:
                print(f"WARNING: Performance log failed (error path): {log_err}")
                db.rollback()
            
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

    @classmethod
    def generate_external_resources(cls, db: Session, user_rid: str, topic: str):
        """
        Generates a curated list of external resources (videos, docs, reading) for a topic.
        Returns a scene-like dictionary for integration into a lesson.
        """
        from app.core.config import Settings
        import litellm
        import os
        
        settings = Settings()
        # 0. Get Active Model from DB
        active_provider, active_model, active_api_key, active_base_url = cls._get_active_model(db)

        # Ensure LiteLLM can find the API key
        env_key_map = {
            "google": "GEMINI_API_KEY",
            "openai": "OPENAI_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY"
        }
        
        if active_provider in env_key_map:
            fallback_key = getattr(settings, f"{active_provider.upper()}_API_KEY", None)
            os.environ[env_key_map[active_provider]] = active_api_key or fallback_key or ""

        try:
            prompt = EXTERNAL_RESOURCES_PROMPT.format(topic=topic)
            
            completion_args = {
                "model": active_model,
                "messages": [
                    {"role": "system", "content": "You are an elite Academic Librarian. Return ONLY valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": { "type": "json_object" }
            }
            
            if active_base_url:
                completion_args["api_base"] = active_base_url
                
            response = litellm.completion(**completion_args)
            data = json.loads(response.choices[0].message.content)
            resources = data.get("resources", [])
            
            if not resources:
                return None
                
            # Build a Resource Hub Scene
            content = f"To further your mastery of **{topic}**, I have curated these elite external resources for you. These will provide additional context, visual demonstrations, and technical depth.\n\n"
            
            for res in resources:
                icon = "🎥" if res['type'] == 'video' else "📄" if res['type'] == 'documentation' else "🛠️" if res['type'] == 'tool' else "📚"
                content += f"### {icon} {res['title']}\n"
                content += f"*{res['description']}*\n\n"
                content += f"🔗 [Access Resource]({res['url']})\n\n---\n\n"
                
            return {
                "id": f"resources_{topic.lower().replace(' ', '_')}",
                "type": "text_explanation",
                "semantic_type": "resource_hub",
                "title": f"Elite Resource Hub: {topic}",
                "content": content,
                "resources": resources,  # --- 🚀 Structured Data (v2.2) ---
                "actions": [],
                "quiz_questions": []
            }
        except Exception as e:
            print(f"ERROR: Resource generation failed: {str(e)}")
            return None

    @classmethod
    def regenerate_single_resource(cls, db: Session, topic: str, old_resource: dict):
        """
        Targeted Regeneration: Replaces a single rejected resource with a new one.
        """
        from app.core.config import Settings
        from app.services.ai_prompts import REGENERATE_RESOURCE_PROMPT
        import litellm
        import os
        
        settings = Settings()
        active_provider, active_model, active_api_key, active_base_url = cls._get_active_model(db)

        env_key_map = {
            "google": "GEMINI_API_KEY",
            "openai": "OPENAI_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY"
        }
        
        if active_provider in env_key_map:
            fallback_key = getattr(settings, f"{active_provider.upper()}_API_KEY", None)
            os.environ[env_key_map[active_provider]] = active_api_key or fallback_key or ""

        try:
            prompt = REGENERATE_RESOURCE_PROMPT.format(
                topic=topic,
                old_title=old_resource.get('title', 'Unknown'),
                old_url=old_resource.get('url', ''),
                type=old_resource.get('type', 'video')
            )
            
            completion_args = {
                "model": active_model,
                "messages": [
                    {"role": "system", "content": "You are an elite Academic Librarian. Return ONLY valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": { "type": "json_object" }
            }
            
            if active_base_url:
                completion_args["api_base"] = active_base_url
                
            response = litellm.completion(**completion_args)
            new_resource = json.loads(response.choices[0].message.content)
            
            return new_resource
        except Exception as e:
            print(f"ERROR: Single resource regeneration failed: {str(e)}")
            return None

    @classmethod
    def generate_subject_discovery(cls, db: Session, topic: str, intent: str = "Full Course", style: str = "Standard") -> dict:
        """
        SUBJECT DISCOVERY AGENT
        ========================
        Ports the multi-component curriculum generation from edupath/server.ts.
        Generates a full 5-component educational payload for any topic not in the
        standard catalog, including:
          A) Subject Metadata & Classification
          B) Sub-Subjects (4-8 branches)
          C) Topics per sub-subject (6-10 micro-topics each)
          D) Phased Roadmap nodes (Beginner → Intermediate → Advanced)
          E) Seed Lesson (textbook-quality entry lesson with SVG illustration)
        """
        from app.core.config import Settings
        import litellm
        import os

        settings = Settings()
        active_provider, active_model, active_api_key, active_base_url = cls._get_active_model(db)

        env_key_map = {
            "google": "GEMINI_API_KEY",
            "openai": "OPENAI_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY"
        }
        if active_provider in env_key_map:
            fallback_key = getattr(settings, f"{active_provider.upper()}_API_KEY", None)
            os.environ[env_key_map[active_provider]] = active_api_key or fallback_key or ""

        clean_topic = topic.strip()
        now_iso = datetime.utcnow().isoformat()

        if active_provider == "mock" or not active_model:
            print(f"DEBUG: [SDA] Mock/unconfigured provider — returning offline fallback for '{clean_topic}'")
            return cls._subject_discovery_offline_fallback(clean_topic, intent, style)

        system_prompt = """You are the SUBJECT DISCOVERY AGENT for EduPath.
Your job is to generate a deeply structured, comprehensive educational curriculum for search queries that are not in our catalog.
You must construct and return exactly FIVE coordinates in a single JSON payload:
- Component A (metadata): subject_id, unified title, slug, clear description, classification (interdisciplinary, existing, or new_top_level), parent tags, estimated total hours, difficulty range.
- Component B (sub_subjects): A list of 4 to 8 sub-subjects dividing the topic meaningfully.
- Component C (topics): A key-value object mapping each sub-subject name to a list of 6 to 10 micro-topics.
- Component D (roadmap): A fully structured Phased sequence of nodes (Beginner, Intermediate, Advanced phase). There must be between 4 and 10 total nodes sequentially mapped.
- Component E (seed_lesson): A textbook-quality, highly engaging initial Lesson containing explanation, analogy, code snippet or equation, visual-illustration-description, steps, and an SVG illustration vector that draws a beautiful conceptual diagram relevant to the top beginner node.

Be highly professional. Ensure your response is beautiful, robust, and matches the requested formatting exactly. Output clean JSON only."""

        user_prompt = f"""Generate a comprehensive dynamic curriculum for this new topic:
Topic: "{clean_topic}"
Chosen Intent Option: "{intent}"
Style Setting: "{style}"

Structure your response as a single clean JSON object matching this schema exactly:
{{
  "classification": {{
    "user_input": "{clean_topic}",
    "classification": "interdisciplinary | existing | new_top_level",
    "parent_subjects": ["Category A", "Category B"],
    "new_entry_type": "subject | sub-subject | topic",
    "placement": "Hierarchy string",
    "also_tagged_under": "Tag string"
  }},
  "metadata": {{
    "subject_id": "unique-slug-based-id",
    "title": "Clean Capitalized Title",
    "slug": "url-friendly-slug",
    "description": "Engaging 2-sentence description",
    "classification": "interdisciplinary | existing | new_top_level",
    "parent_tags": ["tag1", "tag2"],
    "difficulty_range": "Beginner to Advanced",
    "estimated_total_hours": 45,
    "source": "ai-generated",
    "generated_at": "{now_iso}",
    "version": 1,
    "generated_by": "subject-discovery-agent"
  }},
  "sub_subjects": ["Sub-subject Name 1", "Sub-subject Name 2"],
  "topics": {{
    "Sub-subject Name 1": ["Topic 1.1", "Topic 1.2"],
    "Sub-subject Name 2": ["Topic 2.1", "Topic 2.2"]
  }},
  "roadmap": {{
    "topic_id": "url-friendly-slug",
    "topic_name": "Clean Capitalized Title",
    "creation_date": "{now_iso}",
    "version": 1,
    "nodes": [
      {{
        "id": "node_unique_id",
        "topic": "Clean Capitalized Title",
        "phase": "Beginner",
        "title": "Learning Node Title",
        "duration_estimate": "1.5 hours",
        "prerequisites": ["Prior knowledge or prior node title"],
        "outcomes": ["Key measurable learning outcome"],
        "lesson_generated": true
      }}
    ]
  }},
  "seed_lesson": {{
    "concept_explanation": "Extremely high-quality introduction of first node concepts",
    "analogy": "Clear real-world analogy connecting to everyday experience",
    "steps": [
      {{
        "title": "Step title",
        "explanation": "Deep explanation text"
      }}
    ],
    "code_snippet": "Optional sample source code, equations, or pseudo-code",
    "svg_illustration": "An inline SVG string with viewBox='0 0 400 180' using dark background #0f172a, indigo/purple gradients, lines, circles and text labels for stage checkpoints"
  }}
}}"""

        try:
            completion_args = {
                "model": active_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "timeout": 90,
                "num_retries": 1,
                "response_format": {"type": "json_object"}
            }
            if active_base_url:
                completion_args["api_base"] = active_base_url

            print(f"DEBUG: [SDA] Generating subject discovery for '{clean_topic}' via {active_model}")
            response = litellm.completion(**completion_args)
            raw_text = response.choices[0].message.content

            # Strip markdown code fences if present
            import re as _re
            json_match = _re.search(r'```(?:json)?\s*([\s\S]*?)```', raw_text)
            if json_match:
                raw_text = json_match.group(1).strip()

            data = json.loads(raw_text)
            print(f"DEBUG: [SDA] Discovery successful for '{clean_topic}' — {len(data.get('roadmap', {}).get('nodes', []))} nodes generated.")
            return data

        except Exception as e:
            print(f"ERROR: [SDA] Subject Discovery failed for '{clean_topic}': {str(e)}")
            print(f"DEBUG: [SDA] Triggering offline fallback.")
            return cls._subject_discovery_offline_fallback(clean_topic, intent, style)

    @staticmethod
    def _subject_discovery_offline_fallback(topic: str, intent: str, style: str) -> dict:
        """
        Offline fallback for Subject Discovery Agent.
        Returns a professionally-structured curriculum without AI when the model is unavailable.
        Matches the generateOfflineDiscoveryFallback() function from edupath/server.ts.
        """
        import re as _re
        slug = _re.sub(r'[^a-z0-9]+', '-', topic.lower()).strip('-')
        title = ' '.join(w.capitalize() for w in topic.split())
        now_iso = datetime.utcnow().isoformat()

        sub_subjects = [
            f"Foundations of {title}",
            f"Core Principles of {title}",
            f"Applied Methodologies in {title}",
            "Advanced Paradigms & Case Studies"
        ]

        topics_map = {
            f"Foundations of {title}": [
                f"Introduction to {title}",
                f"Core terminology of {title}",
                f"Historical evolution of {title}",
                f"Key stakeholders and use cases",
                f"Fundamental frameworks in {title}",
                f"Scoping and boundary conditions"
            ],
            f"Core Principles of {title}": [
                f"Fundamental structures in {title}",
                f"Analyzing standard parameters in {title}",
                f"Cause-and-effect models in {title}",
                f"Decision logic in {title}",
                f"Systematic breakdown of {title}",
                f"Verification and validation in {title}"
            ],
            f"Applied Methodologies in {title}": [
                f"Practical exercises in {title}",
                f"Applying advanced models to {title}",
                f"Case-based reasoning in {title}",
                f"Tooling and ecosystem for {title}",
                f"Common pitfalls and how to avoid them",
                f"Performance optimization in {title}"
            ],
            "Advanced Paradigms & Case Studies": [
                f"Industry transitions of {title}",
                f"Future research directions in {title}",
                f"Cross-domain integrations",
                f"Ethical considerations in {title}",
                f"Deep synthesis challenge problems",
                f"Capstone project design for {title}"
            ]
        }

        nodes = [
            {
                "id": f"{slug}_node_1",
                "topic": title,
                "phase": "Beginner",
                "title": f"Introduction to {title} & core mechanics",
                "duration_estimate": "1 hour",
                "prerequisites": ["None"],
                "outcomes": [
                    f"Explain the foundational laws of {title}",
                    f"Formulate conceptual models of {title}"
                ],
                "lesson_generated": True
            },
            {
                "id": f"{slug}_node_2",
                "topic": title,
                "phase": "Beginner",
                "title": f"Essential Parameters and Calculations in {title}",
                "duration_estimate": "1.5 hours",
                "prerequisites": [f"Introduction to {title} & core mechanics"],
                "outcomes": [
                    "Differentiate between structural phases",
                    "Perform baseline checks under variable states"
                ],
                "lesson_generated": False
            },
            {
                "id": f"{slug}_node_3",
                "topic": title,
                "phase": "Intermediate",
                "title": "Applied Frameworks and Core Methodologies",
                "duration_estimate": "2 hours",
                "prerequisites": [f"Essential Parameters and Calculations in {title}"],
                "outcomes": [
                    "Incorporate functional metrics in standard environments",
                    "Optimize multi-variable systems"
                ],
                "lesson_generated": False
            },
            {
                "id": f"{slug}_node_4",
                "topic": title,
                "phase": "Advanced",
                "title": "Advanced Architectural Integrations & Synthesis",
                "duration_estimate": "3 hours",
                "prerequisites": ["Applied Frameworks and Core Methodologies"],
                "outcomes": [
                    "Resolve complex diagnostic bottlenecks",
                    "Conduct full-scale performance audits"
                ],
                "lesson_generated": False
            }
        ]

        seed_lesson = {
            "concept_explanation": f"Welcome to {title}! This dynamic curriculum was automatically mapped and compiled by the Subject Discovery Agent. {title} is a multi-dimensional field focusing on the robust execution of structural mechanisms, optimal resource flow, and scientific principles. It forms the bedrock of advanced specialized research, providing practitioners with predictive conceptual tools.",
            "analogy": f"Think of {title} like learning to navigate a newly designed metro system. Before you board a high-speed express train (advanced level), you must first familiarize yourself with the basic transit map, the color-coded lines (foundations), and the mechanics of swiping your fare-card (core terminology). Without these beginner coordinates, you risk getting lost at intermediate transfers!",
            "steps": [
                {
                    "title": "Establishing the Baseline Boundary",
                    "explanation": f"To master {title}, we must first define our analytical limits. Consider how input constraints dictate behavioral outcomes. By isolating variables early, we keep calculations clean and robust."
                },
                {
                    "title": "Tracing Conceptual Dependencies",
                    "explanation": f"Next, examine how secondary factors rely on foundational inputs. Within {title}, execution occurs sequentially, which is why study modules must build exactly on top of prior locks."
                }
            ],
            "code_snippet": f"// Conceptual outline for {title}\nfunction initializeSubject() {{\n  const subject = \"{title}\";\n  console.log(\"Analyzing foundations of \" + subject + \"...\");\n  return {{\n    status: \"active\",\n    source: \"EduPath Subject Discovery\",\n    version: 1.0\n  }};\n}}",
            "svg_illustration": f"""<svg viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg" style="background:#0f172a;border-radius:8px;font-family:monospace">
  <defs>
    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <line x1="0" y1="30" x2="400" y2="30" stroke="#1e293b" stroke-dasharray="4 4"/>
  <line x1="0" y1="90" x2="400" y2="90" stroke="#1e293b" stroke-dasharray="4 4"/>
  <line x1="0" y1="150" x2="400" y2="150" stroke="#1e293b" stroke-dasharray="4 4"/>
  <path d="M 50 90 L 150 90 L 250 90 L 350 90" fill="none" stroke="url(#lineGrad)" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="90" r="12" fill="#312e81" stroke="#818cf8" stroke-width="2.5"/>
  <circle cx="150" cy="90" r="12" fill="#312e81" stroke="#818cf8" stroke-width="2.5"/>
  <circle cx="250" cy="90" r="12" fill="#312e81" stroke="#818cf8" stroke-width="2.5"/>
  <circle cx="350" cy="90" r="12" fill="#312e81" stroke="#818cf8" stroke-width="2.5"/>
  <text x="50" y="125" font-size="9.5" fill="#94a3b8" text-anchor="middle">Foundations</text>
  <text x="150" y="125" font-size="9.5" fill="#94a3b8" text-anchor="middle">Core Principles</text>
  <text x="250" y="125" font-size="9.5" fill="#94a3b8" text-anchor="middle">Application</text>
  <text x="350" y="125" font-size="9.5" fill="#94a3b8" text-anchor="middle">Synthesis</text>
  <text x="50" y="72" font-size="8" fill="#818cf8" font-weight="bold" text-anchor="middle">STAGE 1</text>
  <text x="150" y="72" font-size="8" fill="#818cf8" font-weight="bold" text-anchor="middle">STAGE 2</text>
  <text x="250" y="72" font-size="8" fill="#818cf8" font-weight="bold" text-anchor="middle">STAGE 3</text>
  <text x="350" y="72" font-size="8" fill="#818cf8" font-weight="bold" text-anchor="middle">STAGE 4</text>
  <text x="200" y="20" font-size="10" fill="#a5b4fc" font-weight="bold" text-anchor="middle">{title.upper()} LEARNING MAP</text>
</svg>"""
        }

        return {
            "classification": {
                "user_input": topic,
                "classification": "new_top_level",
                "parent_subjects": ["General Curriculums"],
                "new_entry_type": "subject",
                "placement": f"General Curriculums → {title}",
                "also_tagged_under": "Academic Discovery"
            },
            "metadata": {
                "subject_id": f"sub_{slug}",
                "title": title,
                "slug": slug,
                "description": f"A comprehensive customized study curriculum mapping theoretical frameworks, core principles, and advanced structures of {title}.",
                "classification": "new_top_level",
                "parent_tags": ["academic-discovery"],
                "difficulty_range": "Beginner → Advanced",
                "estimated_total_hours": 45,
                "source": "ai-generated",
                "generated_at": now_iso,
                "version": 1,
                "generated_by": "subject-discovery-agent-offline"
            },
            "sub_subjects": sub_subjects,
            "topics": topics_map,
            "roadmap": {
                "topic_id": slug,
                "topic_name": title,
                "creation_date": now_iso,
                "version": 1,
                "nodes": nodes
            },
            "seed_lesson": seed_lesson
        }

    @classmethod
    def generate_phase_quiz(cls, db: Session, phase: str, topic_name: str, completed_nodes: list = None) -> dict:
        """
        Generates a 4-question phase evaluation quiz using LiteLLM.
        """
        from app.core.config import Settings
        from dotenv import load_dotenv, find_dotenv
        import litellm
        import os
        import json
        import re

        load_dotenv(find_dotenv(), override=True)
        settings = Settings()

        active_provider, active_model, active_api_key, active_base_url = cls._get_active_model(db)

        # Fallback offline quiz
        if active_provider == "mock":
            return cls._mock_quiz_fallback(phase, topic_name)

        api_keys = {
            "google": settings.GOOGLE_API_KEY,
            "openai": settings.OPENAI_API_KEY,
            "anthropic": settings.ANTHROPIC_API_KEY,
            "deepseek": settings.DEEPSEEK_API_KEY,
        }
        
        model = active_model or settings.AI_MODEL
        api_key = active_api_key or api_keys.get(active_provider)
        
        env_key_map = {
            "google": "GEMINI_API_KEY",
            "openai": "OPENAI_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY"
        }
        if active_provider in env_key_map:
            os.environ[env_key_map[active_provider]] = api_key or ""

        if not api_key and active_provider not in ["google", "openai", "anthropic", "deepseek"]:
             api_key = settings.AI_API_KEY

        completed_nodes_str = ", ".join(completed_nodes) if completed_nodes else ""
        lesson_list_context = f'covering the milestones: "{completed_nodes_str}"' if completed_nodes_str else ""

        system_instruction = "You generate interactive, pedagogically sound quizzes in JSON."
        user_prompt = f"""You are the Quiz Agent in EduPath.
Generate an engaging 4-question phase evaluation quiz for the phase: "{phase}" of the topic: "{topic_name}".
{lesson_list_context}
Format output strictly in standard JSON.

The quiz format MUST contain:
- Question 1: Multiple choice (40% weight) - options must be provided as a list of strings
- Question 2: True/False (20% weight) - options must be exactly ["True", "False"]
- Question 3: Short answer (20% weight) - correct answer should be a concise word or phrase
- Question 4: Scenario-based (20% weight) - options must be provided as a list of strings

Each question in the JSON MUST be an object with the fields:
- id: integer
- type: string (exactly: multiple-choice, true-false, short-answer, or scenario)
- question: string
- options: array of strings (required for multiple-choice, true-false, or scenario; for true-false must be exactly ["True", "False"])
- correct_answer: string (the exact matching correct answer option text, true/false string, or a specific short-answer word/phrase)
- explanation: string (comprehensive step-by-step reason of correctness, referencing topics from the completed lessons)

Return the output in this format:
{{
  "phase": "{phase}",
  "questions": [
    ...
  ]
}}
"""

        completion_args = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": 1500,
            "response_format": {"type": "json_object"} if active_provider in ["openai", "google"] else None
        }
        if active_base_url:
            completion_args["api_base"] = active_base_url

        try:
            response = litellm.completion(**completion_args)
            raw_text = response.choices[0].message.content
            
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw_text)
            if json_match:
                raw_text = json_match.group(1).strip()
            
            quiz_data = json.loads(raw_text.strip())
            return quiz_data
        except Exception as e:
            print(f"Error generating phase quiz: {e}")
            return cls._mock_quiz_fallback(phase, topic_name)

    @staticmethod
    def _mock_quiz_fallback(phase: str, topic_name: str) -> dict:
        return {
            "phase": phase,
            "questions": [
                {
                    "id": 1,
                    "type": "multiple-choice",
                    "question": f"In classical learning, what is a primary limitation solved by doing {phase} phase study in {topic_name or 'this subject'}?",
                    "options": [
                        "Lack of precise structure and pacing feedback loop",
                        "Too much memory consumed in basic registers",
                        "Inability to work on offline computers",
                        "None of the options apply"
                    ],
                    "correct_answer": "Lack of precise structure and pacing feedback loop",
                    "explanation": f"A vital element of progress in studying {topic_name} is a targeted testing cycle that provides concrete, spaced reinforcement before transitioning to complex segments."
                },
                {
                    "id": 2,
                    "type": "true-false",
                    "question": f"True or False: Every core milestone in {phase} includes structural boundaries that must be thoroughly processed beforehand.",
                    "options": ["True", "False"],
                    "correct_answer": "True",
                    "explanation": "Prerequisites are structural safety rails designed to prevent concept leakage and downstream learning blocks."
                },
                {
                    "id": 3,
                    "type": "short-answer",
                    "question": "What primary color token hex represents the Accent color utilized in EduPath diagrams? (Include the hash symbol, e.g. #10B981)",
                    "correct_answer": "#10B981",
                    "explanation": "Platform guidelines bind illustrations to the Emerald green accent token #10B981."
                },
                {
                    "id": 4,
                    "type": "scenario",
                    "question": "SCENARIO: A learner tries to skip all Beginner topics and immediately studies Advanced optimization workflows. They crash during implementation. What is the fundamental root cause?",
                    "options": [
                        "Skipping the milestone prerequisites and essential foundation phases",
                        "Incorrect computer architecture config parameters",
                        "Failing to install Node package bundlers",
                        "Inadequate server response timeouts"
                    ],
                    "correct_answer": "Skipping the milestone prerequisites and essential foundation phases",
                    "explanation": "Mastering intermediate state controls is non-negotiable for diagnosing and debugging runtime bugs in production."
                }
            ]
        }


ai_tutor_engine = AITutorEngine()

