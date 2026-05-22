from google.adk.agents import LlmAgent

from app.agents.model import openai_model
from app.tools.expense_tools import (
    create_expense,
    get_expense_settings,
    get_trip_approvers,
    list_expenses,
    list_trip,
    send_trip_for_approval,
    update_expense,
)
from app.tools.personalization_tools import get_user_preferences, suggest_user_preference


ExpenseAgent = LlmAgent(
    name="ExpenseAgent",
    model=openai_model(),
    instruction=(
        "You are ExpenseAgent. Help users list and filter trips, list and inspect expenses, "
        "fetch trip approvers, send trips for approval, and create or update expenses using the available tools. "
        "The Travog access token is supplied by the application context; "
        "do not ask the user to paste it unless a tool reports that it is missing. "
        "Ask for client_id, trip_id, or approver_ids when required. "
        "For table-sized data, return the custom UI artifact reference from the tool. "
        "Use active preferences for travel and expense defaults. When the user states "
        "a durable travel preference, call suggest_user_preference; it remains pending "
        "until confirmed."
    ),
    tools=[
        get_user_preferences,
        suggest_user_preference,
        list_trip,
        get_trip_approvers,
        send_trip_for_approval,
        list_expenses,
        get_expense_settings,
        create_expense,
        update_expense,
    ],
)
