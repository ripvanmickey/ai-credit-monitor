"""Append public DRAMeXchange session averages to the memory dashboard."""
import json
import re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

MARKET_TZ = timezone(timedelta(hours=8))


class Board(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.text = []
        self.rows = []
        self.row = None
        self.cell = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("th", "td") and self.row is not None:
            self.cell = []

    def handle_endtag(self, tag):
        if tag in ("th", "td") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None

    def handle_data(self, data):
        self.text.append(data)
        if self.cell is not None:
            self.cell.append(data)

    def timestamp(self, heading, today):
        match = re.search(
            rf"{heading}\s*Last Update:\s*([A-Za-z]{{3}})\.?\s*(\d{{1,2}})"
            r"\s+(\d{4})\s+(\d{2}:\d{2})\s*\(GMT\+8\)",
            " ".join(self.text), re.IGNORECASE,
        )
        if not match:
            raise ValueError(f"Missing source timestamp for {heading}")
        month, day, year, time = match.groups()
        stamp = datetime.strptime(f"{year} {month} {day} {time}", "%Y %b %d %H:%M")
        if stamp.date().isoformat() > today:
            raise ValueError(f"Future source timestamp for {heading}")
        return stamp.date().isoformat(), time

    def quote(self, spec, change_column):
        header = None
        for row in self.rows:
            normalized = [cell.casefold() for cell in row]
            if "session average" in normalized:
                header = normalized
            if not row or not header or row[0] != spec or change_column not in header:
                continue
            average_index = header.index("session average")
            change_index = header.index(change_column)
            if len(row) <= max(average_index, change_index):
                continue
            average, change = row[average_index], row[change_index]
            if re.fullmatch(r"\d+(?:\.\d+)?", average) and re.fullmatch(
                r"[+-]?\d+(?:\.\d+)?\s*%", change
            ) and float(average) > 0:
                return float(average), float(change.rstrip("%"))
        raise ValueError(f"Missing public session average or change for {spec}")


def refresh(snapshot, html, today):
    board = Board(html)
    groups = {
        "DRAM": ("DRAM Spot Price", "session change"),
        "NAND": ("Wafer Spot Price", "average change"),
    }
    timestamps = {product: board.timestamp(heading, today)
                  for product, (heading, _) in groups.items()}
    changed = []
    for current in snapshot["spot"]:
        product = current["product"]
        if current["source"] != "board" or product not in groups:
            continue
        spec = current["spec"].replace("×", "x").removesuffix(" (Wafer Spot)")
        date, time = timestamps[product]
        value, change = board.quote(spec, groups[product][1])
        if (date, time) <= (current["date"], current.get("time", "")):
            continue
        if date > current["date"]:
            identity = ("product", "spec", "unit", "date")
            snapshot["history"] = [
                row for row in snapshot["history"]
                if any(row[key] != current[key] for key in identity)
            ]
            snapshot["history"].append({
                key: current[key] for key in (*identity, "time", "value", "source") if key in current
            })
        current.update(date=date, time=time, value=value, change=change)
        changed.append(current["spec"])
    if changed:
        snapshot["checkedOn"] = max(today, snapshot["checkedOn"])
    return changed


def main():
    path = Path(__file__).resolve().parents[1] / "cycle-public" / "memory-data.json"
    snapshot = json.loads(path.read_text(encoding="utf-8"))
    request = Request(snapshot["sources"]["board"][1], headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        html = response.read().decode(response.headers.get_content_charset() or "utf-8")
    changed = refresh(snapshot, html, datetime.now(MARKET_TZ).date().isoformat())
    if changed:
        path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("Updated:", ", ".join(changed))
    else:
        print("No newer public memory quotes")


if __name__ == "__main__":
    main()
