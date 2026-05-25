from importlib import resources


PROMPT_PACKAGE = "app.agents"
PROMPT_DIR = "prompts"
GLOBAL_RULES_FILE = "global_rules.txt"


def load_prompt_text(*filenames: str) -> str:
    """Load and combine prompt text files from the agent prompts directory."""
    parts: list[str] = []
    prompt_root = resources.files(PROMPT_PACKAGE).joinpath(PROMPT_DIR)
    for filename in filenames:
        text = prompt_root.joinpath(filename).read_text(encoding="utf-8").strip()
        if text:
            parts.append(text)
    return "\n\n".join(parts)


def load_agent_prompt(filename: str) -> str:
    return load_prompt_text(GLOBAL_RULES_FILE, filename)
