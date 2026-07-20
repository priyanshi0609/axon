"""
Thin wrapper around the Gemini text generation API.
Every other service that needs an LLM call (entity extraction, RAG answers,
reasoning) goes through this module so the model name / retry logic /
error handling lives in exactly one place.
"""
import os
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.5-flash")


def generate_text(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = 0.3,
) -> str:

    response = client.models.generate_content(
        model=CHAT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=temperature,
            system_instruction=system_instruction,
        ),
    )

    return response.text.strip()


def generate_json(prompt: str, system_instruction: str | None = None) -> dict:

    raw = generate_text(
        prompt,
        system_instruction=system_instruction,
        temperature=0.1,
    )

    cleaned = raw.strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "")
        cleaned = cleaned.replace("```", "").strip()

    return json.loads(cleaned)