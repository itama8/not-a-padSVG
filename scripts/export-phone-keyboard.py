"""Write the complete phone keyboard component as a single ES module."""

import json
from pathlib import Path


root = Path(__file__).resolve().parents[1] / "site"
module = (root / "ui/phone-keyboard/index.js").read_text(encoding="utf-8")
svg = (root / "reference/phone-keyboard.svg").read_text(encoding="utf-8")
marker = "const embeddedArtwork = null;"
if module.count(marker) != 1:
    raise SystemExit("Expected one artwork placeholder in the keyboard module.")
print(module.replace(marker, f"const embeddedArtwork = {json.dumps(svg, ensure_ascii=False)};"), end="")
