from __future__ import annotations

import os
from pathlib import Path

import pytest
from google.adk.evaluation.agent_evaluator import AgentEvaluator
from google.adk.evaluation.eval_config import EvalConfig
from google.adk.evaluation.eval_set import EvalSet


HARNESS_DIR = Path(__file__).parent / "evals" / "adk_harness"
EVAL_FILE = HARNESS_DIR / "travel_agent_core.test.json"
CONFIG_FILE = HARNESS_DIR / "test_config.json"
MIN_SCENARIOS = 10
MAX_SCENARIOS = 15


def load_eval_set() -> EvalSet:
    return EvalSet.model_validate_json(EVAL_FILE.read_text(encoding="utf-8"))


def test_adk_harness_eval_set_is_valid() -> None:
    eval_set = load_eval_set()

    assert eval_set.eval_set_id == "travel_agent_core"
    assert MIN_SCENARIOS <= len(eval_set.eval_cases) <= MAX_SCENARIOS


def test_adk_harness_eval_ids_are_unique() -> None:
    eval_set = load_eval_set()
    eval_ids = [case.eval_id for case in eval_set.eval_cases]

    assert len(eval_ids) == len(set(eval_ids))


def test_adk_harness_scenarios_have_session_and_expected_response() -> None:
    eval_set = load_eval_set()

    for case in eval_set.eval_cases:
        assert case.session_input is not None, case.eval_id
        assert case.session_input.app_name == "adk-travel-agents"
        assert case.session_input.user_id, case.eval_id
        assert case.conversation, case.eval_id

        for invocation in case.conversation:
            assert invocation.user_content.parts, case.eval_id
            assert invocation.final_response is not None, case.eval_id
            assert invocation.final_response.parts, case.eval_id


def test_adk_harness_config_is_valid() -> None:
    config = EvalConfig.model_validate_json(CONFIG_FILE.read_text(encoding="utf-8"))

    assert config.criteria["tool_trajectory_avg_score"] == 0.8
    assert config.criteria["response_match_score"] == 0.35


@pytest.mark.asyncio
async def test_live_adk_harness() -> None:
    if os.getenv("RUN_ADK_HARNESS") != "1":
        pytest.skip("Set RUN_ADK_HARNESS=1 to execute the live ADK eval harness.")
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY is required for the live ADK eval harness.")

    await AgentEvaluator.evaluate(
        agent_module="app.agents.root",
        eval_dataset_file_path_or_dir=str(EVAL_FILE),
        num_runs=1,
        print_detailed_results=True,
    )
