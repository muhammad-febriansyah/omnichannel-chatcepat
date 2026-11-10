"""SQLAlchemy 2.0 models domain. `Base.metadata` = target autogenerate Alembic.

Skema kanonik dipegang migration (docs/prd/02-data-model.md). Tambah model lalu
`make makemigration m="..."`. Semua model di-import di sini supaya mapper ter-konfigurasi
dan metadata terisi penuh.
"""

from .base import Base
from .tenant import Tenant
from .user import User
from .channel import Channel
from .contact import Contact
from .conversation import Conversation
from .message import Message
from .conversation_state import ConversationState
from .flow import Flow
from .knowledge import AiUnanswered, KnowledgeChunk, KnowledgeDocument, KnowledgeFaq
from .broadcast import Broadcast, BroadcastRecipient
from .tag import Tag
from .template import Template
from .audit import AuditLog
from .plan import Plan
from .order import Order
from .product import Product
from .social import SocialAccount, SocialActivityLog, SocialJob
from .email_notification import EmailNotification
from .ai_agent import AiAgent, AiAgentKnowledge, Promo
from .referral import (
    Referral,
    ReferralAccount,
    ReferralCommission,
    ReferralPayout,
    ReferralSettings,
)

__all__ = [
    "Base",
    "Tenant",
    "User",
    "Channel",
    "Contact",
    "Conversation",
    "Message",
    "ConversationState",
    "Flow",
    "KnowledgeDocument",
    "KnowledgeChunk",
    "KnowledgeFaq",
    "AiUnanswered",
    "Broadcast",
    "BroadcastRecipient",
    "Tag",
    "Template",
    "AuditLog",
    "Plan",
    "Order",
    "Product",
    "SocialAccount",
    "SocialJob",
    "SocialActivityLog",
    "EmailNotification",
    "AiAgent",
    "AiAgentKnowledge",
    "Promo",
    "ReferralSettings",
    "ReferralAccount",
    "Referral",
    "ReferralPayout",
    "ReferralCommission",
]
