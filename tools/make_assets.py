"""Generate app icons and the fallback reminders.ics.

Usage: python3 tools/make_assets.py [--surgery YYYY-MM-DD] [--start YYYY-MM-DD]
"""
import argparse
import datetime as dt
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TOTAL_DAYS = 30
URL = "https://baicao7788-cyber.github.io/recovery-helper/"

ITEMS = [
    ("07:30", "起床喝一杯温水", "", 1, TOTAL_DAYS),
    ("08:00", "早餐", "看「吃什么」", 1, TOTAL_DAYS),
    ("10:00", "上午走动", "第1周慢走5–10分钟，第2周约15分钟，第3–4周20–30分钟", 1, TOTAL_DAYS),
    ("12:00", "午餐", "", 1, TOTAL_DAYS),
    ("13:00", "午休 30–60 分钟", "", 1, TOTAL_DAYS),
    ("15:30", "下午走动", "第1周慢走5–10分钟，第2周约15分钟，第3–4周20–30分钟", 1, TOTAL_DAYS),
    ("16:00", "加餐＋喝水", "水果或酸奶，全天喝水 1.5–2 升", 1, TOTAL_DAYS),
    ("18:00", "晚餐", "", 1, TOTAL_DAYS),
    ("20:30", "看一眼伤口", "干燥、无红肿渗液就好", 1, 14),
    ("21:00", "花 30 秒做今天的记录", "在「记录」里", 1, TOTAL_DAYS),
    ("22:30", "准备睡觉，23 点前睡", "", 1, TOTAL_DAYS),
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
    text = "愈"
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
             "METHOD:PUBLISH", "X-WR-CALNAME:康复助手"]
    uid = 0

    def event(day: dt.date, time: str, title: str, desc: str, count: int, alarm_min: int = 0):
        nonlocal uid
        uid += 1
        h, m = map(int, time.split(":"))
        begin = dt.datetime.combine(day, dt.time(h, m))
        end = begin + dt.timedelta(minutes=10)
        lines.extend(["BEGIN:VEVENT", f"UID:rh-static-{surgery}-{uid}@recovery-helper", f"DTSTAMP:{stamp}",
                      f"DTSTART:{begin:%Y%m%dT%H%M%S}", f"DTEND:{end:%Y%m%dT%H%M%S}"])
        if count > 1:
            lines.append(f"RRULE:FREQ=DAILY;COUNT={count}")
        lines.append(fold("SUMMARY:" + esc(title)))
        if desc:
            lines.append(fold("DESCRIPTION:" + esc(desc)))
        lines.extend(["BEGIN:VALARM", "ACTION:DISPLAY", fold("DESCRIPTION:" + esc(title)),
                      f"TRIGGER:-PT{alarm_min}M", "END:VALARM", "END:VEVENT"])

    start_n = (start - surgery).days
    for time, label, sub, frm, to in ITEMS:
        frm = max(frm, start_n)
        if frm > to:
            continue
        desc = (sub + "\n" if sub else "") + f"打卡：{URL}"
        event(surgery + dt.timedelta(days=frm), time, "康复 · " + label, desc, to - frm + 1)
    for n in (7, 14, 21, 28):
        if n >= start_n:
            event(surgery + dt.timedelta(days=n), "20:00", f"康复 · 看第 {n // 7} 周恢复评估",
                  "打开康复助手「每周」页，愿意的话复制发给照顾小组", 1)
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
