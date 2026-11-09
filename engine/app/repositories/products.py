from __future__ import annotations

import uuid

from sqlalchemy import Integer, case, func, literal, or_, select
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


async def count_active(session: AsyncSession, tenant_id: uuid.UUID) -> int:
    return await session.scalar(
        select(func.count()).select_from(Product).where(Product.tenant_id == tenant_id, Product.active.is_(True))
    ) or 0


async def search_active(
    session: AsyncSession, tenant_id: uuid.UUID, words: list[str], limit: int = 15
) -> list[Product]:
    """Active products matching the customer's words (name/category/SKU/description),
    best matches first — so the AI sees the right items in a big catalog."""
    if not words:
        return []
    fields = [Product.name, Product.category, Product.sku, Product.description]
    hit = [or_(*(func.lower(func.coalesce(f, "")).contains(w) for f in fields)) for w in words]
    # Name matches count double.
    score = sum(
        (
            case((func.lower(Product.name).contains(w), literal(2)), else_=literal(0))
            + case((h, literal(1)), else_=literal(0))
            for w, h in zip(words, hit)
        ),
        literal(0),
    ).cast(Integer)
    stmt = (
        select(Product)
        .where(Product.tenant_id == tenant_id, Product.active.is_(True), or_(*hit))
        .order_by(score.desc(), (Product.stock > 0).desc(), Product.created_at.desc())
        .limit(limit)
    )
    return list(await session.scalars(stmt))
