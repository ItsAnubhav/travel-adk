from google.adk.agents import LlmAgent

from app.agents.model import openai_model
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
    instruction=(
        "You are BookingAgent. Retrieve bookings, fare rules, cancellation details, "
        "and reissue details. Keep booking payloads out of the LLM response; when a "
        "tool returns a ui_component and artifact_id, summarize the key outcome and "
        "let the frontend render the details. To fetch fare rules, use a flight_id "
        "from the booking details payload. Use active preferences to tailor booking "
        "help. When the user states a durable travel preference, call "
        "suggest_user_preference; it remains pending until confirmed."
    ),
    tools=[
        get_user_preferences,
        suggest_user_preference,
        get_booking,
        get_fare_rules,
        get_cancellation_policy,
        get_reissue_policy,
    ],
)
