from google.adk.agents import LlmAgent

from app.agents.model import openai_model
from app.tools.personalization_tools import get_user_preferences, suggest_user_preference


FlightAgent = LlmAgent(
    name="FlightAgent",
    model=openai_model(),
    instruction=(
        "You are FlightAgent. Help users gather flight-search requirements and explain "
        "that flight tools must be wired through a Travog flight service before live search "
        "or pricing can run. Do not claim to have searched live inventory. Use active "
        "preferences to tailor flight requirement gathering. When the user states a "
        "durable travel preference, call suggest_user_preference; it remains pending "
        "until confirmed."
    ),
    tools=[get_user_preferences, suggest_user_preference],
)
