from app.core.personalization import format_agent_personalization


def test_format_agent_personalization_excludes_secrets() -> None:
    text = format_agent_personalization(
        {
            "profile": {
                "name": "Ada",
                "access_token": "secret",
                "email": "ada@example.com",
            },
            "preferences": [
                {
                    "category": "flight",
                    "key": "seat",
                    "value": "aisle",
                }
            ],
        }
    )

    assert "Ada" in text
    assert "flight.seat=aisle" in text
    assert "secret" not in text
    assert "access_token" not in text
