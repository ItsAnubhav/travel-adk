from app.agents.expense_agent import ExpenseAgent
from app.agents.prompts import load_agent_prompt, load_prompt_text


def test_load_agent_prompt_includes_global_rules_and_agent_prompt() -> None:
    prompt = load_agent_prompt("booking.txt")

    assert "User types:" in prompt
    assert "Admin: Can view any other person's bookings" in prompt
    assert "You are BookingAgent." in prompt


def test_load_prompt_text_combines_files_with_spacing() -> None:
    prompt = load_prompt_text("global_rules.txt", "flight.txt")

    assert "Global travel operations rules" in prompt
    assert "\n\nYou are FlightAgent." in prompt


def test_expense_agent_uses_expense_prompt_file() -> None:
    prompt = load_agent_prompt("expense.txt")

    assert ExpenseAgent.instruction == prompt
    assert "You are ExpenseAgent." in prompt
