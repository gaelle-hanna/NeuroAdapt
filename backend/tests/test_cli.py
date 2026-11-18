import pytest
from app import cli
from app.schemas import Registration


def test_cli_validation_does_not_reveal_password(monkeypatch):
    secret = 'short123'

    def invalid_registration():
        Registration(email='test@example.com', first_name='Test', last_name='User',
                     password=secret, confirm_password=secret)

    monkeypatch.setattr(cli, 'main', invalid_registration)
    with pytest.raises(SystemExit) as caught:
        cli.run()
    message = str(caught.value)
    assert 'at least 10 characters' in message
    assert secret not in message
    assert 'input_value' not in message
