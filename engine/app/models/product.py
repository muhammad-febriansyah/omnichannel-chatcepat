from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin


class Product(UUIDPkMixin, TimestampMixin, Base):
    """Katalog produk tenant (sumber balasan otomatis: node flow send_catalog + konteks AI).

    Skema milik web (CRUD via Drizzle). DDL tetap di migration Alembic (skema = satu pemilik).
    Uang = BIGINT rupiah penuh (no float, docs/prd root). Foto = array URL upload.
    """

    __tablename__ = "products"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text)
    price_idr: Mapped[int] = mapped_column(sa.BigInteger, nullable=False, server_default="0")
    sku: Mapped[str | None] = mapped_column(sa.Text)
    stock: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")
    category: Mapped[str | None] = mapped_column(sa.Text)
    photos: Mapped[list[str]] = mapped_column(
        ARRAY(sa.Text), nullable=False, server_default=sa.text("'{}'::text[]")
    )
    active: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("true")
    )
