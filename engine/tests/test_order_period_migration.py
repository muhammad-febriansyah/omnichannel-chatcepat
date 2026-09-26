"""Subscription duration migration preserves existing orders and rolls back."""

import importlib.util
import os
from pathlib import Path
from uuid import uuid4

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_order_period_backfill_and_rollback():
    dsn = os.getenv("SOCIAL_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("requires isolated SOCIAL_TEST_DATABASE_URL")
    engine = sa.create_engine(dsn.replace("postgres://", "postgresql://", 1))
    schema = "period_test_" + uuid4().hex
    path = Path(__file__).parents[1] / "migrations/versions/0019_order_period.py"
    spec = importlib.util.spec_from_file_location("order_period_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql(f"CREATE SCHEMA {schema}")
            connection.exec_driver_sql(f"SET LOCAL search_path TO {schema}")
            connection.exec_driver_sql("CREATE TABLE plans (id text PRIMARY KEY, period text)")
            connection.exec_driver_sql("CREATE TABLE orders (id text PRIMARY KEY, plan_id text)")
            connection.exec_driver_sql("INSERT INTO plans VALUES ('annual', 'year'), ('monthly', 'month')")
            connection.exec_driver_sql("INSERT INTO orders VALUES ('a', 'annual'), ('m', 'monthly'), ('legacy', NULL)")
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                assert dict(connection.exec_driver_sql("SELECT id, period FROM orders").all()) == {"a": "year", "m": "month", "legacy": "month"}
                migration.downgrade()
            assert connection.exec_driver_sql("SELECT count(*) FROM orders").scalar_one() == 3
            connection.exec_driver_sql(f"DROP SCHEMA {schema} CASCADE")
    finally:
        engine.dispose()
