"""
Thin wrapper around the Gemini text generation API.
Every other service that needs an LLM call (entity extraction, RAG answers,
reasoning) goes through this module so the model name / retry logic /
error handling lives in exactly one place.
"""

import os
import json
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Keep the model name in one place and override via .env if Google
# renames / deprecates a version — avoids hunting through the codebase.
CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.0-flash")


def generate_text(prompt: str, system_instruction: str | None = None, temperature: float = 0.3) -> str:
    """Single-shot text generation. No conversation history is kept here —
    callers pass the full context they need in `prompt`."""
    model = genai.GenerativeModel(
        model_name=CHAT_MODEL,
        system_instruction=system_instruction,
    )
    response = model.generate_content(
        prompt,
        generation_config={"temperature": temperature},
    )
    return (response.text or "").strip()


def generate_json(prompt: str, system_instruction: str | None = None) -> dict:
    """Ask the model for strict JSON and parse it. Strips markdown fences
    if the model ignores instructions and wraps the JSON in ```json blocks."""
    raw = generate_text(prompt, system_instruction=system_instruction, temperature=0.1)
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json\n", "", 1) if cleaned.startswith("json\n") else cleaned
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Last resort: find the first { ... } block in the response
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            return json.loads(cleaned[start:end + 1])
        raise
