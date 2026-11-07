"""eval_expr — operator kondisi flow builder (contains/starts_with/is_empty/...)."""

import pytest

from app.pipeline.flow_engine import eval_expr


CTX = {"nama": "Budi Santoso", "kota": "  JAKARTA  ", "kosong": "", "pilihan": "a", "ref": "budi santoso"}


@pytest.mark.parametrize(
    "expr,expected",
    [
        # Sintaks lama tetap persis (case-sensitive).
        ("pilihan == 'a'", True),
        ("pilihan == 'A'", False),
        ("pilihan != 'b'", True),
        ('pilihan == "a"', True),
        ("nama == ref", False),
        # equals / not_equals: case-insensitive + trim.
        ("kota equals 'jakarta'", True),
        ("nama equals ref", True),
        ("kota not_equals 'bandung'", True),
        ("kota not_equals 'Jakarta'", False),
        # contains / starts_with.
        ("nama contains 'SANTO'", True),
        ("nama contains 'andi'", False),
        ("nama contains ''", False),
        ("nama starts_with 'budi'", True),
        ("nama starts_with 'santoso'", False),
        ("kota starts_with \"jak\"", True),
        # is_empty / not_empty (var tak ada = kosong).
        ("kosong is_empty", True),
        ("tidak_ada is_empty", True),
        ("nama is_empty", False),
        ("nama not_empty", True),
        ("kosong not_empty", False),
        # Ekspresi rusak → False, bukan error.
        ("", False),
        ("nama ~~ 'x'", False),
    ],
)
def test_eval_expr(expr, expected):
    assert eval_expr(expr, CTX) is expected


def test_literal_with_operator_text_is_not_misparsed():
    assert eval_expr("nama contains 'a == b'", {"nama": "x a == b y"}) is True
