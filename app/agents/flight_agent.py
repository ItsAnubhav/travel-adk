from google.adk.agents import LlmAgent

from app.agents.model import openai_model
from app.agents.prompts import load_agent_prompt
from app.tools.flight_tools import flight_search_tool
from app.tools.personalization_tools import get_user_preferences, suggest_user_preference


FlightAgent = LlmAgent(
    name="FlightAgent",
    model=openai_model(),
    instruction=load_agent_prompt("flight.txt"),
    tools=[get_user_preferences, suggest_user_preference, flight_search_tool],
)
