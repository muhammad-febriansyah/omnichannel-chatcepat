from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Product


async def list_active(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    category: str | None = None,
    limit: int = 20,
) -> list[Product]:
    """Produk aktif tenant (untuk balas katalog flow + konteks AI). Tenant scope wajib.

    Urut: stok>0 dulu (yang bisa dibeli), lalu terbaru.
    """
    stmt = select(Product).where(
        Product.tenant_id == tenant_id, Product.active.is_(True)
    )
    if category:
        stmt = stmt.where(Product.category == category)
    stmt = stmt.order_by((Product.stock > 0).desc(), Product.created_at.desc()).limit(limit)
    res = await session.scalars(stmt)
    return list(res)
