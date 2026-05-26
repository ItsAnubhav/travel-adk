# ADK Harness

This directory contains the focused ADK evaluation harness for the travel agents.
Keep this suite small: 10 to 15 scenarios that guard the highest-risk agent
behaviors.

Normal `pytest` validates that the ADK eval file is well-formed and stays within
the target scenario count. It does not call a model.

Run the live ADK harness explicitly:

```bash
RUN_ADK_HARNESS=1 pytest tests/test_adk_harness.py
```

The live run uses `google.adk.evaluation.agent_evaluator.AgentEvaluator` against
`app.agents.root`. It needs the same model credentials as the app, such as
`OPENAI_API_KEY`.

When adding scenarios, prefer durable behavior checks:

- routing to the correct agent domain
- required clarification before unsafe or incomplete actions
- expected tool names and important arguments
- UI artifact display intent, such as `ui_display: split_view`
- policy boundaries for employee/admin access
