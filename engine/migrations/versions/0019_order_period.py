"""Snapshot subscription duration on orders."""

import sqlalchemy as sa
from alembic import op

revision = "0019_order_period"
down_revision = "0018_social_comment_targets"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("orders", sa.Column("period", sa.Text(), nullable=False, server_default="month"))
    op.execute("UPDATE orders SET period=plans.period FROM plans WHERE orders.plan_id=plans.id AND plans.period IN ('month','year')")
    op.create_check_constraint("ck_order_period", "orders", "period IN ('month','year')")


def downgrade():
    op.drop_constraint("ck_order_period", "orders", type_="check")
    op.drop_column("orders", "period")
