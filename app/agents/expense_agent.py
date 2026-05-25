from google.adk.agents import LlmAgent

from app.agents.model import openai_model
from app.agents.prompts import load_agent_prompt
from app.tools.expense_tools import (
    create_expense,
    get_expense_settings,
    get_trip_approvers,
    list_expenses,
    list_trip,
    send_trip_for_approval,
    update_expense,
)
from app.tools.interaction_tools import ask_user_choice
from app.tools.personalization_tools import get_user_preferences, suggest_user_preference


ExpenseAgent = LlmAgent(
    name="ExpenseAgent",
    model=openai_model(),
    instruction=load_agent_prompt("expense.txt"),
    tools=[
        get_user_preferences,
        suggest_user_preference,
        ask_user_choice,
        list_trip,
        get_trip_approvers,
        send_trip_for_approval,
        list_expenses,
        get_expense_settings,
        create_expense,
        update_expense,
    ],
)
