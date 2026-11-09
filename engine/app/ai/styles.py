"""Reply styles for AI agents (migration 0022).

Tone/emoji/length/greeting/language are fixed templates kept server-side so every
tenant gets consistent, tested wording; tenants add their own instructions and
example Q&A on top.
"""

from __future__ import annotations

from dataclasses import dataclass, field

ROLE_PERSONA = {
    "cs": (
        "Kamu Customer Service bisnis ini. Tujuanmu membantu pelanggan dengan jawaban yang "
        "jelas dan akurat, menyelesaikan pertanyaan secepatnya."
    ),
    "sales": (
        "Kamu sales bisnis ini yang paham produk. Pahami kebutuhan pelanggan, rekomendasikan "
        "produk yang pas dari katalog, jelaskan manfaatnya singkat, lalu bantu sampai pesan."
    ),
    "reservasi": (
        "Kamu admin reservasi bisnis ini. Bantu pelanggan memilih jadwal/layanan, kumpulkan "
        "data yang diperlukan (nama, tanggal, jam, jumlah orang) satu per satu, lalu konfirmasi."
    ),
    "promosi": (
        "Kamu admin promosi bisnis ini. Tugasmu menjelaskan promo yang sedang berjalan, "
        "membuat pelanggan tertarik, dan mengarahkan mereka untuk membeli atau klaim promo."
    ),
    "sosial": (
        "Kamu admin media sosial bisnis ini yang membalas komentar publik. Balasan harus "
        "sangat singkat, sopan, dan tidak membagikan data pribadi di publik. Untuk detail "
        "(harga khusus, pesanan, data pribadi), ajak pelanggan lanjut lewat DM/chat."
    ),
}

TONE_GUIDE = {
    "ramah": "Nada: hangat dan bersahabat seperti CS yang senang membantu. Kalimat positif dan sopan.",
    "profesional": (
        "Nada: formal dan sopan. Gunakan 'saya' dan bahasa baku, tanpa bahasa gaul. "
        "Tetap ringkas dan jelas."
    ),
    "promosi": (
        "Nada: persuasif dan antusias. Tonjolkan manfaat produk dan promo AKTIF yang ada di "
        "data. Tutup dengan ajakan bertindak yang jelas (mis. pesan sekarang, klaim promo). "
        "Jangan memaksa dan jangan pernah mengarang promo atau diskon."
    ),
    "santai": (
        "Nada: santai dan akrab, bahasa sehari-hari (aku-kamu) seperti chat dengan teman, "
        "tetap sopan."
    ),
    "singkat": "Nada: langsung ke inti. Maksimal 1-2 kalimat, tanpa basa-basi.",
    "empatik": (
        "Nada: empatik dan menenangkan. Akui perasaan pelanggan, minta maaf bila ada masalah, "
        "lalu beri solusi konkret langkah demi langkah."
    ),
}

EMOJI_GUIDE = {
    "tanpa": "Jangan pakai emoji.",
    "sedikit": "Emoji paling banyak 1 per pesan, hanya bila cocok.",
    "banyak": "Boleh 2-3 emoji yang relevan per pesan.",
}

LENGTH_GUIDE = {
    "pendek": "Panjang: 1-3 kalimat per balasan, seperti chat WhatsApp asli.",
    "sedang": "Panjang: maksimal 5 kalimat, atau daftar pendek bila perlu.",
}

GREETING_GUIDE = {
    "kak": "Sapa pelanggan dengan 'Kak'.",
    "bapak_ibu": "Sapa pelanggan dengan 'Bapak/Ibu'.",
    "nama": "Sapa pelanggan dengan namanya bila diketahui (sesekali, jangan tiap pesan).",
}

LANGUAGE_GUIDE = {
    "auto": "Balas dengan bahasa yang dipakai pelanggan.",
    "id": "Selalu balas dalam Bahasa Indonesia.",
    "en": "Always reply in English.",
}

# Formatting rules that hold for every style (WhatsApp, not Markdown).
FORMAT_GUIDE = (
    "Format WhatsApp, bukan Markdown: tebal pakai *bintang*, jangan pakai judul '#' atau tabel. "
    "Jangan mengulang info yang sudah disebut di percakapan ini. Maksimal satu pertanyaan balik "
    "per pesan. Hindari kalimat pembuka template yang terdengar robot."
)

MAX_EXAMPLES = 5


@dataclass
class AgentSpec:
    """Plain view of an agent (DB row or unsaved form values for the simulator)."""

    name: str = "Asisten"
    role: str = "cs"
    tone: str = "ramah"
    emoji: str = "sedikit"
    length: str = "pendek"
    greeting: str = "kak"
    language: str = "auto"
    goal: str | None = None
    instructions: str | None = None
    examples: list = field(default_factory=list)
    handoff_rules: str | None = None
    fallback_message: str | None = None
    knowledge_all: bool = True
    document_ids: list = field(default_factory=list)
    use_catalog: bool = True
    use_promos: bool = True

    @classmethod
    def from_dict(cls, raw: dict) -> "AgentSpec":
        """Settings stored on a flow AI node (or sent by the simulator); unknown keys dropped."""
        import uuid
        from dataclasses import fields

        allowed = {f.name for f in fields(cls)}
        values = {k: v for k, v in (raw or {}).items() if k in allowed and v is not None}
        ids = []
        for item in values.get("document_ids") or []:
            try:
                ids.append(uuid.UUID(str(item)))
            except ValueError:
                continue
        values["document_ids"] = ids
        if not isinstance(values.get("examples"), list):
            values["examples"] = []
        return cls(**values)

    @classmethod
    def from_row(cls, row, document_ids: list | None = None) -> "AgentSpec":
        return cls(
            name=row.name,
            role=row.role,
            tone=row.tone,
            emoji=row.emoji,
            length=row.length,
            greeting=row.greeting,
            language=row.language,
            goal=row.goal,
            instructions=row.instructions,
            examples=list(row.examples or []),
            handoff_rules=row.handoff_rules,
            fallback_message=row.fallback_message,
            knowledge_all=row.knowledge_all,
            document_ids=list(document_ids or []),
            use_catalog=row.use_catalog,
            use_promos=row.use_promos,
        )


def style_prompt(agent: AgentSpec) -> str:
    """Persona + style block for the system prompt (tenant text comes after)."""
    parts = [ROLE_PERSONA.get(agent.role, ROLE_PERSONA["cs"])]
    if agent.goal:
        parts.append(f"Tujuan utama percakapan: {agent.goal.strip()}")
    parts.append(
        "\n".join(
            [
                "Gaya bicara (WAJIB):",
                "- " + TONE_GUIDE.get(agent.tone, TONE_GUIDE["ramah"]),
                "- " + EMOJI_GUIDE.get(agent.emoji, EMOJI_GUIDE["sedikit"]),
                "- " + LENGTH_GUIDE.get(agent.length, LENGTH_GUIDE["pendek"]),
                "- " + GREETING_GUIDE.get(agent.greeting, GREETING_GUIDE["kak"]),
                "- " + LANGUAGE_GUIDE.get(agent.language, LANGUAGE_GUIDE["auto"]),
                "- " + FORMAT_GUIDE,
            ]
        )
    )
    return "\n\n".join(parts)


def examples_prompt(agent: AgentSpec) -> str:
    """Few-shot style examples written by the tenant (style, not facts)."""
    pairs = []
    for ex in agent.examples or []:
        q = str((ex or {}).get("q", "")).strip()
        a = str((ex or {}).get("a", "")).strip()
        if q and a:
            pairs.append(f"Pelanggan: {q}\nKamu: {a}")
        if len(pairs) == MAX_EXAMPLES:
            break
    if not pairs:
        return ""
    return (
        "Contoh gaya jawaban dari pemilik bisnis — tiru GAYA-nya, bukan isinya (fakta tetap "
        "harus dari data):\n\n" + "\n\n".join(pairs)
    )
