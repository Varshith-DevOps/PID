import re


EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")


def redact_pii(text: str | None) -> str:
    if not text:
        return ""
    redacted = EMAIL_RE.sub("[email-redacted]", text)
    return PHONE_RE.sub("[phone-redacted]", redacted)
