"""Generate app icons and the fallback reminders.ics (08:00-22:00, hourly).

Usage: python3 tools/make_assets.py [--surgery YYYY-MM-DD] [--start YYYY-MM-DD]
"""
import argparse
import datetime as dt
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
URL = "https://baicao7788-cyber.github.io/recovery-helper/"
WAKE, SLEEP, INTERVAL = 8 * 60, 22 * 60, 60

PHASES = [
    (1, 3, "屋里走 3–5 分钟", "扶着慢慢站起来，在屋里走 3–5 分钟。躺着时每小时做 10 次踝泵。"),
    (4, 7, "走 5–10 分钟", "在屋里或楼下走 5–10 分钟，累了就停。"),
    (8, 14, "走 10 分钟左右", "起来走 10 分钟左右；上午、下午各散步 15 分钟。"),
    (15, 30, "站起来活动 3–5 分钟", "坐着别超过一小时；每天再散步 20–30 分钟。"),
]


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), "#fbe5da")
    d = ImageDraw.Draw(img)
    pad = size * 0.16
    d.ellipse([pad, pad, size - pad, size - pad], fill="#d9805f")
    font = None
    for path in ["/System/Library/Fonts/STHeiti Medium.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc"]:
        try:
            font = ImageFont.truetype(path, int(size * 0.36))
            break
        except OSError:
            continue
    text = "走"
    box = d.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), text, fill="#ffffff", font=font)
    return img


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold(line: str) -> str:
    out, cur, n = [], "", 0
    for ch in line:
        b = len(ch.encode("utf-8"))
        if n + b > 73:
            out.append(cur)
            cur, n = " ", 1
        cur += ch
        n += b
    out.append(cur)
    return "\r\n".join(out)


def make_ics(surgery: dt.date, start: dt.date) -> str:
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//recovery-helper//CN", "CALSCALE:GREGORIAN",
             "METHOD:PUBLISH", "X-WR-CALNAME:起来走走"]
    slots = list(range(WAKE + INTERVAL, SLEEP - 30 + 1, INTERVAL))
    start_n = max(1, (start - surgery).days)
    uid = 0
    for frm, to, short, desc in PHASES:
        frm = max(frm, start_n)
        if frm > to:
            continue
        day = surgery + dt.timedelta(days=frm)
        for t in slots:
            uid += 1
            begin = dt.datetime.combine(day, dt.time(t // 60, t % 60))
            end = begin + dt.timedelta(minutes=5)
            title = "起来走走 · " + short
            lines += ["BEGIN:VEVENT", f"UID:stand-static-{surgery}-{uid}@recovery-helper", f"DTSTAMP:{stamp}",
                      f"DTSTART:{begin:%Y%m%dT%H%M%S}", f"DTEND:{end:%Y%m%dT%H%M%S}"]
            if to > frm:
                lines.append(f"RRULE:FREQ=DAILY;COUNT={to - frm + 1}")
            lines.append(fold("SUMMARY:" + esc(title)))
            lines.append(fold("DESCRIPTION:" + esc(f"{desc}\n走完点一下：{URL}")))
            lines += ["BEGIN:VALARM", "ACTION:DISPLAY", fold("DESCRIPTION:" + esc(title)),
                      "TRIGGER:-PT0M", "END:VALARM", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--surgery", default="2026-11-06")
    ap.add_argument("--start", default=None)
    a = ap.parse_args()
    surgery = dt.date.fromisoformat(a.surgery)
    start = dt.date.fromisoformat(a.start) if a.start else max(surgery + dt.timedelta(days=1), dt.date.today())

    make_icon(180).save(ROOT / "icon-180.png")
    make_icon(512).save(ROOT / "icon-512.png")
    (ROOT / "reminders.ics").write_bytes(make_ics(surgery, start).encode("utf-8"))
    print("ok", surgery, start)


if __name__ == "__main__":
    main()
