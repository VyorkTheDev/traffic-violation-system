from flask import jsonify


def normalize_plate(plate: str) -> str:
    return plate.upper().replace(" ", "").strip()


def ok(data=None, message=None, code=200):
    body = {"success": True}
    if data is not None:
        body["data"] = data
    if message is not None:
        body["message"] = message
    return jsonify(body), code


def err(message, code=400):
    return jsonify({"success": False, "message": message}), code
