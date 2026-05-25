from google.adk.agents import LlmAgent

from app.agents.model import openai_model
from app.agents.prompts import load_agent_prompt
from app.tools.booking_tools import (
    get_booking,
    get_cancellation_policy,
    get_fare_rules,
    get_reissue_policy,
)
from app.tools.personalization_tools import get_user_preferences, suggest_user_preference


BookingAgent = LlmAgent(
    name="BookingAgent",
    model=openai_model(),
    instruction=load_agent_prompt("booking.txt"),
    tools=[
        get_user_preferences,
        suggest_user_preference,
        get_booking,
        get_fare_rules,
        get_cancellation_policy,
        get_reissue_policy,
    ],
)
