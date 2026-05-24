import re
from flask import jsonify

# Türk plaka harfleri (Q, W, X yok)
_PLATE_LETTERS = "ABCDEFGHIJKLMNOPRSTUVYZ"

_TR_MAP = str.maketrans("ÇçĞğİıÖöŞşÜü", "CCGGIIOOSSUu")

_PLATE_RE = re.compile(
    r"^(0[1-9]|[1-7][0-9]|8[01])"
    r"(?:[ABCDEFGHIJKLMNOPRSTUVYZ]{1}[0-9]{4}"
    r"|[ABCDEFGHIJKLMNOPRSTUVYZ]{2}[0-9]{3,4}"
    r"|[ABCDEFGHIJKLMNOPRSTUVYZ]{3}[0-9]{2,4})$"
)


def normalize_plate(plate: str) -> str:
    """Türkçe karakterleri dönüştürür, büyük harfe çevirir, boşluk/tire/nokta kaldırır."""
    return re.sub(r"[^A-Z0-9]", "", plate.translate(_TR_MAP).upper())


def validate_plate(plate: str) -> bool:
    """Normalize edilmiş plakanın Türk plaka formatına uygun olup olmadığını kontrol eder."""
    return bool(_PLATE_RE.match(plate))


def ok(data=None, message=None, code=200, meta=None):
    body = {"success": True}
    if data is not None:
        body["data"] = data
    if message is not None:
        body["message"] = message
    if meta is not None:
        body["meta"] = meta
    return jsonify(body), code


def err(message, code=400):
    return jsonify({"success": False, "message": message}), code
