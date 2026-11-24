"""Write the complete phone keyboard component as a single ES module."""

import json
from pathlib import Path


root = Path(__file__).resolve().parents[1] / "site"
keyboard = root / "ui/phone-keyboard"
module = (keyboard / "index.js").read_text(encoding="utf-8")
typing = (keyboard / "typing.js").read_text(encoding="utf-8")
svg = (root / "reference/phone-keyboard.svg").read_text(encoding="utf-8")


def replace_once(source, marker, replacement):
    if source.count(marker) != 1:
        raise SystemExit(f"Expected one keyboard export marker: {marker}")
    return source.replace(marker, replacement, 1)


typing = replace_once(typing, "export function createPhoneKeyboardTyping(", "function createPhoneKeyboardTyping(")
module = replace_once(module, "import { createPhoneKeyboardTyping } from './typing.js?v=1.4.1';", typing.rstrip())
module = replace_once(module, "const embeddedArtwork = null;", f"const embeddedArtwork = {json.dumps(svg, ensure_ascii=False)};")
print(module, end="")
