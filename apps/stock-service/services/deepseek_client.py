import json
import os

import httpx

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"


class DeepSeekClient:
    """DeepSeek API client for routine AI tasks (cheaper alternative to Claude)."""

    def __init__(self):
        self.api_key = os.getenv("DEEPSEEK_API_KEY")

    async def analyze(self, prompt: str, data: dict, model: str = "deepseek-chat") -> str:
        """Send structured data + prompt to DeepSeek for analysis."""
        content = f"{prompt}\n\n## Data\n```json\n{json.dumps(data, default=str)}\n```"

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": content}],
                    "max_tokens": 4096,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            result = resp.json()
            return result["choices"][0]["message"]["content"]
