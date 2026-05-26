from google.adk.agents import LlmAgent

from app.agents.booking_agent import BookingAgent
from app.agents.expense_agent import ExpenseAgent
from app.agents.flight_agent import FlightAgent
from app.agents.model import openai_model
from app.agents.prompts import load_agent_prompt
from app.tools.interaction_tools import ask_user_choice
from app.tools.personalization_tools import get_user_preferences, suggest_user_preference
from app.tools.rag_tools import search_company_documents


root_agent = LlmAgent(
    name="TravelOrchestrator",
    model=openai_model(),
    instruction=load_agent_prompt("root.txt"),
    tools=[get_user_preferences, suggest_user_preference, search_company_documents, ask_user_choice],
    sub_agents=[FlightAgent, ExpenseAgent, BookingAgent],
)


AGENT_REGISTRY = {
    "root": root_agent,
    "flight": FlightAgent,
    "expense": ExpenseAgent,
    "booking": BookingAgent,
}
