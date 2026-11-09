"""Turn business sources into knowledge text (tahap 2).

- extract_file: PDF / Word (.docx) / plain text → text.
- fetch_url_text: one public web page → readable text. Guarded against SSRF: only
  http(s), only public IPs, the resolved IP is pinned for the connection (no DNS
  rebinding), redirects re-checked, size and time limited.
- parse_table: CSV / Excel → header + rows (product / FAQ import in the web app).
"""

from __future__ import annotations

import asyncio
import csv
import io
import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_TEXT_CHARS = 200_000
MAX_PAGE_BYTES = 2 * 1024 * 1024
MAX_TABLE_ROWS = 2000
FETCH_TIMEOUT_S = 12
MAX_REDIRECTS = 3

TEXT_EXT = {".txt", ".md", ".markdown", ".csv"}


class ExtractError(ValueError):
    """Readable reason (Indonesian) for the user."""


def _clean(text: str) -> str:
    lines = [" ".join(line.split()) for line in (text or "").splitlines()]
    out = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    return out[:MAX_TEXT_CHARS]


def _ext(filename: str) -> str:
    m = re.search(r"(\.[a-z0-9]+)$", (filename or "").lower())
    return m.group(1) if m else ""


def _decode(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


def extract_file(filename: str, data: bytes) -> str:
    if len(data) > MAX_FILE_BYTES:
        raise ExtractError("File maksimal 10 MB")
    ext = _ext(filename)
    if ext == ".pdf":
        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise ExtractError("PDF terkunci password — buka kuncinya dulu")
            text = "\n\n".join((page.extract_text() or "") for page in reader.pages[:300])
        except ExtractError:
            raise
        except Exception as e:  # malformed PDF
            raise ExtractError("PDF tidak bisa dibaca") from e
    elif ext == ".docx":
        from docx import Document

        try:
            doc = Document(io.BytesIO(data))
        except Exception as e:
            raise ExtractError("File Word tidak bisa dibaca (pakai format .docx)") from e
        parts = [p.text for p in doc.paragraphs]
        for table in doc.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text.strip() for cell in row.cells))
        text = "\n".join(parts)
    elif ext in TEXT_EXT:
        text = _decode(data)
    else:
        raise ExtractError("Format belum didukung. Pakai PDF, Word (.docx), atau TXT")
    text = _clean(text)
    if len(text) < 20:
        raise ExtractError("Tidak ada teks yang bisa dibaca (PDF hasil scan/gambar belum didukung)")
    return text


# --- URL ---------------------------------------------------------------------------


def _public_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_global and not addr.is_multicast


async def _resolve_public(host: str, port: int) -> str:
    """First public IP for host; any non-public answer rejects the host."""
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise ExtractError("Alamat website tidak ditemukan") from e
    ips = [info[4][0] for info in infos]
    if not ips or not all(_public_ip(ip) for ip in ips):
        raise ExtractError("Alamat website tidak diizinkan")
    return ips[0]


def check_url(url: str) -> tuple[str, str, int]:
    """(scheme, host, port) of an allowed URL, or ExtractError."""
    parts = urlsplit((url or "").strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ExtractError("Masukkan alamat lengkap, mis. https://tokoanda.com/faq")
    if parts.username or parts.password:
        raise ExtractError("Alamat website tidak diizinkan")
    port = parts.port or (443 if parts.scheme == "https" else 80)
    if port not in (80, 443):
        raise ExtractError("Alamat website tidak diizinkan")
    host = parts.hostname
    try:  # a literal IP must itself be public
        literal_ok = _public_ip(host)
    except ValueError:
        literal_ok = None  # a hostname, checked after DNS resolution
    if literal_ok is False:
        raise ExtractError("Alamat website tidak diizinkan")
    if host == "localhost" or host.endswith((".local", ".internal", ".localhost")):
        raise ExtractError("Alamat website tidak diizinkan")
    return parts.scheme, host, port


class _TextParser(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "template", "iframe", "head", "nav"}
    INLINE_GAP = {"a", "span", "td", "th", "button", "label", "strong", "b", "em"}
    BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "ul", "ol", "table"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        if tag in self.SKIP:
            self._skip += 1
        elif tag in self.BLOCK:
            self.parts.append("\n")
        elif tag in self.INLINE_GAP:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        elif tag in self.BLOCK:
            self.parts.append("\n")
        elif tag in self.INLINE_GAP:
            self.parts.append(" ")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> tuple[str, str]:
    """(title, readable text) of an HTML page."""
    p = _TextParser()
    p.feed(html)
    return " ".join(p.title.split())[:120], _clean("".join(p.parts))


async def fetch_url_text(url: str) -> tuple[str, str]:
    """(title, text) of one public page."""
    current = url.strip()
    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_S, follow_redirects=False, trust_env=False) as client:
        for _ in range(MAX_REDIRECTS + 1):
            scheme, host, port = check_url(current)
            ip = await _resolve_public(host, port)
            parts = urlsplit(current)
            ip_host = f"[{ip}]" if ":" in ip else ip
            pinned = urlunsplit((scheme, f"{ip_host}:{port}", parts.path or "/", parts.query, ""))
            headers = {"Host": host if port in (80, 443) else f"{host}:{port}", "User-Agent": "ChatCepatBot/1.0 (+knowledge import)"}
            # Connect to the checked IP; TLS still verifies the certificate for `host`.
            async with client.stream("GET", pinned, headers=headers, extensions={"sni_hostname": host}) as resp:
                if resp.status_code in (301, 302, 303, 307, 308):
                    loc = resp.headers.get("location")
                    if not loc:
                        raise ExtractError("Website mengalihkan tanpa alamat tujuan")
                    current = urljoin(current, loc)
                    continue
                if resp.status_code >= 400:
                    raise ExtractError(f"Website menjawab {resp.status_code}")
                ctype = resp.headers.get("content-type", "").lower()
                if not ("text/html" in ctype or "text/plain" in ctype or "xhtml" in ctype):
                    raise ExtractError("Alamat itu bukan halaman web (pakai Upload file untuk PDF)")
                body = b""
                async for chunk in resp.aiter_bytes():
                    body += chunk
                    if len(body) > MAX_PAGE_BYTES:
                        raise ExtractError("Halaman terlalu besar (maks 2 MB)")
                text = _decode(body)
                if "text/plain" in ctype:
                    return "", _clean(text)
                title, content = html_to_text(text)
                if len(content) < 20:
                    raise ExtractError("Halaman tidak berisi teks yang bisa dibaca")
                return title, content
    raise ExtractError("Terlalu banyak pengalihan alamat")


# --- tables (CSV / Excel) ------------------------------------------------------------


def parse_table(filename: str, data: bytes) -> dict:
    """{"columns": [...], "rows": [[...], ...]} — first non-empty row = header."""
    if len(data) > MAX_FILE_BYTES:
        raise ExtractError("File maksimal 10 MB")
    ext = _ext(filename)
    rows: list[list[str]] = []
    if ext == ".csv" or ext == ".txt":
        text = _decode(data)
        try:
            dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        for row in csv.reader(io.StringIO(text), dialect):
            rows.append([c.strip() for c in row])
            if len(rows) > MAX_TABLE_ROWS:
                break
    elif ext in (".xlsx", ".xlsm"):
        from openpyxl import load_workbook

        try:
            wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        except Exception as e:
            raise ExtractError("File Excel tidak bisa dibaca (pakai format .xlsx)") from e
        ws = wb.worksheets[0]
        for row in ws.iter_rows(values_only=True):
            rows.append(["" if v is None else str(v).strip() for v in row])
            if len(rows) > MAX_TABLE_ROWS:
                break
        wb.close()
    else:
        raise ExtractError("Pakai file Excel (.xlsx) atau CSV")
    rows = [r for r in rows if any(c for c in r)]
    if len(rows) < 2:
        raise ExtractError("File kosong atau hanya berisi judul kolom")
    header, body = rows[0], rows[1 : MAX_TABLE_ROWS + 1]
    width = len(header)
    return {"columns": header, "rows": [(r + [""] * width)[:width] for r in body]}
