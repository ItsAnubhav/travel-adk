from google.adk.agents import LlmAgent

from app.agents.booking_agent import BookingAgent
from app.agents.expense_agent import ExpenseAgent
from app.agents.flight_agent import FlightAgent
from app.agents.model import openai_model
from app.tools.personalization_tools import get_user_preferences, suggest_user_preference


root_agent = LlmAgent(
    name="TravelOrchestrator",
    model=openai_model(),
    instruction=(
        "You are the travel operations orchestrator. Route flight shopping and pricing "
        "to FlightAgent, expense workflows to ExpenseAgent, and booking, fare rule, "
        "cancellation, or reissue requests to BookingAgent. Prefer tool calls over "
        "guessing. Never expose credentials. Never inline huge tool payloads; use "
        "custom UI artifacts. Use active personalization context to tailor travel "
        "answers. When the user states a durable travel preference, call "
        "suggest_user_preference; do not say it is saved until confirmed."
    ),
    tools=[get_user_preferences, suggest_user_preference],
    sub_agents=[FlightAgent, ExpenseAgent, BookingAgent],
)


AGENT_REGISTRY = {
    "root": root_agent,
    "flight": FlightAgent,
    "expense": ExpenseAgent,
    "booking": BookingAgent,
}
