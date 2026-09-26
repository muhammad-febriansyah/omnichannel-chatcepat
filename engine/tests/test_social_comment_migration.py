"""Apply and roll back the social comment migration on an isolated schema."""

import importlib.util
import os
from pathlib import Path
from uuid import uuid4

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_comment_targets_migration_preserves_existing_rows():
    dsn = os.getenv("SOCIAL_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("requires isolated SOCIAL_TEST_DATABASE_URL")
    engine = sa.create_engine(dsn.replace("postgres://", "postgresql://", 1))
    schema = "migration_test_" + uuid4().hex
    module_path = Path(__file__).parents[1] / "migrations/versions/0018_social_comment_targets.py"
    spec = importlib.util.spec_from_file_location("social_comment_migration", module_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql(f"CREATE SCHEMA {schema}")
            connection.exec_driver_sql(f"SET LOCAL search_path TO {schema}")
            connection.exec_driver_sql("CREATE TABLE social_account_settings (social_account_id text PRIMARY KEY)")
            connection.exec_driver_sql("CREATE TABLE social_event_actions (id text PRIMARY KEY)")
            connection.exec_driver_sql("INSERT INTO social_account_settings VALUES ('existing')")
            connection.exec_driver_sql("INSERT INTO social_event_actions VALUES ('old-action')")
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                assert connection.exec_driver_sql("SELECT comment_post_urls FROM social_account_settings").scalar_one() == []
                assert connection.exec_driver_sql("SELECT dedupe_key FROM social_event_actions").scalar_one() is None
                migration.downgrade()
            assert connection.exec_driver_sql("SELECT id FROM social_event_actions").scalar_one() == "old-action"
            connection.exec_driver_sql(f"DROP SCHEMA {schema} CASCADE")
    finally:
        engine.dispose()
