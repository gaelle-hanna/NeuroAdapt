from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from app.database import Base


def test_initial_migration_roundtrip(tmp_path, monkeypatch):
    from sqlalchemy import create_engine
    import app.database
    migration_engine = create_engine(f'sqlite:///{tmp_path / "migration.db"}')
    monkeypatch.setattr(app.database, 'engine', migration_engine)
    cfg = Config('alembic.ini')
    command.upgrade(cfg, 'head')
    assert set(inspect(migration_engine).get_table_names()) == set(Base.metadata.tables) | {'alembic_version'}
    for table in Base.metadata.sorted_tables:
        assert {c['name'] for c in inspect(migration_engine).get_columns(table.name)} == set(table.columns.keys())
    command.downgrade(cfg, 'base')
    assert inspect(migration_engine).get_table_names() == ['alembic_version']
    migration_engine.dispose()
