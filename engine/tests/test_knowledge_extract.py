"""Knowledge tahap 2: file/URL/table extraction and the SSRF guard."""

import asyncio
import io

import pytest

from app.ai import extract
from app.ai.extract import ExtractError, check_url, extract_file, html_to_text, parse_table


def _pdf(text: str) -> bytes:
    """Minimal one-page PDF with a text line (valid xref offsets)."""
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = b"%PDF-1.4\n", []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return out


def test_pdf_docx_and_text_files():
    assert "Kebijakan retur 7 hari" in extract_file("kebijakan.pdf", _pdf("Kebijakan retur 7 hari untuk semua produk"))

    from docx import Document

    d = Document()
    d.add_paragraph("Jam buka Senin sampai Sabtu pukul 08.00-16.00")
    t = d.add_table(rows=1, cols=2)
    t.rows[0].cells[0].text, t.rows[0].cells[1].text = "Ongkir Jakarta", "Rp10.000"
    buf = io.BytesIO()
    d.save(buf)
    text = extract_file("sop.docx", buf.getvalue())
    assert "Jam buka Senin" in text and "Ongkir Jakarta | Rp10.000" in text

    assert extract_file("faq.txt", "Bisa COD area Jakarta dan Tangerang ya kak".encode()) .startswith("Bisa COD")
    with pytest.raises(ExtractError):
        extract_file("foto.jpg", b"\xff\xd8" * 50)
    with pytest.raises(ExtractError):
        extract_file("kosong.txt", b"   ")


def test_html_to_text_drops_scripts_and_keeps_title():
    title, text = html_to_text(
        "<html><head><title>FAQ Toko Mulia</title><style>p{}</style></head>"
        "<body><script>alert(1)</script><h1>Pengiriman</h1><p>Kirim tiap hari kerja.</p><ul><li>JNE</li><li>SiCepat</li></ul></body></html>"
    )
    assert title == "FAQ Toko Mulia"
    assert "alert" not in text and "Pengiriman" in text and "SiCepat" in text


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com/x",
        "http://localhost/admin",
        "http://127.0.0.1/",
        "http://10.0.0.5/",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/",
        "http://192.168.1.1/",
        "https://example.com:8443/",
        "https://user:pass@example.com/",
        "http://redis.internal/",
        "not a url",
    ],
)
def test_check_url_blocks_internal_targets(url):
    with pytest.raises(ExtractError):
        check_url(url)


def test_check_url_allows_public_sites():
    assert check_url("https://tokomulia.id/faq?x=1") == ("https", "tokomulia.id", 443)
    assert check_url("http://8.8.8.8/") == ("http", "8.8.8.8", 80)


def test_hostname_resolving_to_private_ip_is_rejected(monkeypatch):
    class Loop:
        async def getaddrinfo(self, *a, **k):
            return [(None, None, None, None, ("10.1.2.3", 80))]

    monkeypatch.setattr(extract.asyncio, "get_running_loop", lambda: Loop())
    with pytest.raises(ExtractError):
        asyncio.run(extract.fetch_url_text("http://looks-public.example/"))


def test_parse_table_csv_and_xlsx():
    csv_bytes = "Nama;Harga;Stok\nSusu Bebelac;150000;12\nPopok M;99000;0\n".encode()
    t = parse_table("produk.csv", csv_bytes)
    assert t["columns"] == ["Nama", "Harga", "Stok"] and t["rows"][1] == ["Popok M", "99000", "0"]

    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Pertanyaan", "Jawaban"])
    ws.append(["Bisa COD?", "Bisa, area Jakarta"])
    ws.append([None, None])
    buf = io.BytesIO()
    wb.save(buf)
    t = parse_table("faq.xlsx", buf.getvalue())
    assert t == {"columns": ["Pertanyaan", "Jawaban"], "rows": [["Bisa COD?", "Bisa, area Jakarta"]]}
    with pytest.raises(ExtractError):
        parse_table("x.pdf", b"%PDF")
