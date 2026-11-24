"""Export a standalone SVG key from the phone keyboard artwork."""

import argparse
from pathlib import Path
import xml.etree.ElementTree as ET


SVG = "http://www.w3.org/2000/svg"
NS = {"svg": SVG}
SOURCE = Path(__file__).resolve().parents[1] / "site/reference/phone-keyboard.svg"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("key", nargs="?", help="key ID, such as KeyQ, Space, or Enter")
    selection.add_argument("--list", action="store_true", help="print all available key IDs")
    args = parser.parse_args()

    keyboard = ET.parse(SOURCE).getroot()
    keys = {key.attrib["data-key"]: key for key in keyboard.findall(".//svg:g[@data-key]", NS)}
    if args.list:
        print("\n".join(keys))
        return
    if args.key not in keys:
        parser.error(f"unknown key {args.key!r}. Use --list to see the available IDs.")

    key = keys[args.key]
    if "data-symbol-only" in key.attrib:
        key.attrib.pop("style", None)
    outline = key.find("svg:rect", NS)
    x, y, width, height = (float(outline.attrib[name]) for name in ("x", "y", "width", "height"))
    # Leave a transparent margin for the outline stroke.
    view_box = f"{x - 2:g} {y - 2:g} {width + 4:g} {height + 4:g}"
    ET.register_namespace("", SVG)
    image = ET.Element(
        f"{{{SVG}}}svg",
        {"viewBox": view_box, "width": f"{width + 4:g}", "height": f"{height + 4:g}",
         "role": "img", "aria-labelledby": "title"},
    )
    title = ET.SubElement(image, f"{{{SVG}}}title", id="title")
    label = args.key.removeprefix("Key")
    alternate = key.find("svg:text[@class='alternate']", NS)
    title.text = f"{label} key" if alternate is None else f"{label} key, long-press {alternate.text}"
    image.append(keyboard.find("svg:style", NS))
    icon = key.find("svg:use", NS)
    if icon is not None:
        symbol_id = icon.attrib["href"].removeprefix("#")
        defs = ET.SubElement(image, f"{{{SVG}}}defs")
        defs.append(keyboard.find(f"svg:defs/svg:symbol[@id='{symbol_id}']", NS))
    image.append(key)
    ET.indent(image)
    print(ET.tostring(image, encoding="unicode"))


if __name__ == "__main__":
    main()
