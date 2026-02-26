import json
import os

import anthropic


class ClaudeClient:
    """Claude API client for AI analysis workflows."""

    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    async def analyze(self, prompt: str, data: dict, model: str = "claude-sonnet-4-20250514") -> str:
        """Send structured data + prompt to Claude for analysis."""
        message = await self.client.messages.create(
            model=model,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": f"{prompt}\n\n## Data\n```json\n{json.dumps(data, default=str)}\n```",
                }
            ],
        )
        return message.content[0].text

    async def deep_analyze(self, prompt: str, data: dict) -> str:
        """Use Claude Opus for deep research reports."""
        return await self.analyze(prompt, data, model="claude-opus-4-20250514")
