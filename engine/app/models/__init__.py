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
from .knowledge import KnowledgeDocument, KnowledgeChunk
from .broadcast import Broadcast, BroadcastRecipient
from .tag import Tag
from .template import Template
from .audit import AuditLog

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
    "Broadcast",
    "BroadcastRecipient",
    "Tag",
    "Template",
    "AuditLog",
]
