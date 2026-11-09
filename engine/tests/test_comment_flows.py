"""Comment-triggered flows (FB/IG): trigger matching, reply nodes, Meta reply shaping."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.pipeline import flow_engine
from app.pipeline.reply import Reply
from app.repositories import flows as flows_repo
from app.services.inbound import comment_replies

CH_A = uuid.uuid4()
CH_B = uuid.uuid4()


def _flow(trigger: dict, extra_nodes=(), name="f"):
    nodes = [{"id": "t", "type": "trigger", "trigger": trigger, "next": "r"}, *extra_nodes]
    return SimpleNamespace(id=uuid.uuid4(), name=name, trigger=trigger["kind"], definition={"nodes": nodes})


def test_comment_trigger_keywords_posts_and_channels():
    catch_all = _flow({"kind": "comment", "match": []}, name="all")
    harga = _flow({"kind": "comment", "match": ["harga"], "channels": [str(CH_A)]}, name="harga")
    post = _flow({"kind": "comment", "match": [], "posts": ["999"]}, name="post")
    chat = _flow({"kind": "keyword", "match": ["harga"]}, name="chat")
    active = [catch_all, harga, post, chat]

    ok = lambda ch: [f for f in active if flows_repo._channel_ok(f, ch)]  # noqa: E731
    assert flows_repo._match_comment(ok(CH_A), "berapa harga?", "PAGE_1").name == "harga"
    # Same comment on another account: keyword flow is limited to CH_A → catch-all.
    assert flows_repo._match_comment(ok(CH_B), "berapa harga?", "PAGE_1").name == "all"
    # Post filter accepts the bare post id for FB "<page>_<post>" ids.
    only_post = [post]
    assert flows_repo._match_comment(only_post, "wow", "PAGE_999").name == "post"
    assert flows_repo._match_comment(only_post, "wow", "PAGE_123") is None
    # Chat keyword flows never answer comments.
    assert flows_repo._match_comment([chat], "harga", "P") is None


async def test_reply_nodes_in_comment_context():
    flow = SimpleNamespace(
        definition={
            "nodes": [
                {"id": "t", "type": "trigger", "next": "r"},
                {"id": "r", "type": "reply_comment", "texts": ["Cek DM ya {{nama}}!"], "next": "d"},
                {"id": "d", "type": "private_reply", "text": "Halo {{nama}}, ini katalognya", "next": None},
            ]
        }
    )
    inbound = SimpleNamespace(comment=SimpleNamespace(comment_id="C1", post_id="P1"))
    out = flow_engine.FlowOutcome()
    await flow_engine._walk(None, None, None, None, inbound, flow, "t", {"nama": "Sari"}, out)
    assert [(r.text, r.mode) for r in out.replies] == [
        ("Cek DM ya Sari!", "comment_reply"),
        ("Halo Sari, ini katalognya", "private_reply"),
    ]

    # Outside a comment: no public reply, private reply is a normal message.
    out = flow_engine.FlowOutcome()
    await flow_engine._walk(None, None, None, None, SimpleNamespace(comment=None), flow, "t", {"nama": "Sari"}, out)
    assert [(r.text, r.mode) for r in out.replies] == [("Halo Sari, ini katalognya", None)]


def test_comment_replies_merge_into_single_private_reply():
    shaped = comment_replies(
        [
            Reply(text="Sudah kami DM ya", mode="comment_reply"),
            Reply(text="Halo!"),
            Reply(text="Pilih:", buttons=[("1", "Harga"), ("2", "Lokasi")]),
            Reply(text="Bonus", mode="private_reply"),
        ]
    )
    assert [r.mode for r in shaped] == ["comment_reply", "private_reply"]
    assert shaped[1].text == "Halo!\n\nPilih:\n\n1. Harga\n2. Lokasi\n\nBonus"
