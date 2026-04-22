#!/usr/bin/env python3
"""
Parse KademeQMS_DF8D_Analizleri_*.docx (flat paragraphs) into non_conformities
analysis JSON + core fields. Outputs SQL with dollar-quoting for JSONB columns.
"""
from __future__ import annotations

import json
import re
import secrets
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def extract_paragraphs(docx_path: Path) -> List[str]:
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    out: List[str] = []
    for p in root.iter(f"{{{NS}}}p"):
        parts: List[str] = []
        for t in p.iter(f"{{{NS}}}t"):
            if t.text:
                parts.append(t.text)
            if t.tail:
                parts.append(t.tail)
        s = "".join(parts).strip()
        if s:
            out.append(s)
    return out


def find_report_starts(paras: List[str]) -> List[Tuple[int, str, str]]:
    """Returns list of (index, nc_number, kind) where kind is DF or 8D."""
    starts: List[Tuple[int, str, str]] = []
    re_df = re.compile(r"^DÜZELTİCİ FAALİYET RAPORU - (DF-2026-\d+)$")
    re_8d = re.compile(r"^8D RAPORU - (8D-2026-\d+)$")
    for i, p in enumerate(paras):
        m = re_df.match(p.strip())
        if m:
            starts.append((i, m.group(1), "DF"))
            continue
        m = re_8d.match(p.strip())
        if m:
            starts.append((i, m.group(1), "8D"))
    return starts


def slice_section(paras: List[str], starts: List[Tuple[int, str, str]], idx: int) -> List[str]:
    a = starts[idx][0]
    b = starts[idx + 1][0] if idx + 1 < len(starts) else len(paras)
    return paras[a:b]


def take_until(lines: List[str], start: int, stop_markers: Tuple[str, ...]) -> Tuple[str, int]:
    """Collect lines from start until a line starts with any stop marker (exclusive). Returns text, next index."""
    buf: List[str] = []
    i = start
    while i < len(lines):
        line = lines[i]
        if any(line.startswith(m) for m in stop_markers):
            break
        buf.append(line)
        i += 1
    return "\n".join(buf).strip(), i


def kv_block(
    lines: List[str],
    i: int,
    stop_at: Tuple[str, ...],
    labels_extra: Optional[set] = None,
) -> Tuple[Dict[str, str], int]:
    """Read label\\nvalue pairs until stop_at line."""
    data: Dict[str, str] = {}
    labels = {
        "Rapor No",
        "Rapor Türü",
        "Birim/Departman",
        "Yayın Tarihi",
        "Sorumlu Kişi",
        "Parça Adı",
        "Parça Kodu",
        "Araç Tipi",
        "Maliyet Tutarı",
        "Problem Tanimi",
        "Toplam Kayıt",
        "Toplam Adet",
    }
    if labels_extra:
        labels |= labels_extra
    while i < len(lines):
        line = lines[i]
        if line in stop_at:
            break
        if line in labels and i + 1 < len(lines):
            data[line] = lines[i + 1]
            i += 2
            continue
        i += 1
    return data, i


def parse_5n1k(lines: List[str], i: int) -> Tuple[Dict[str, str], int]:
    if i >= len(lines) or not lines[i].startswith("2. 5N1K"):
        return {}, i
    i += 1
    # skip Soru/Açıklama
    while i < len(lines) and lines[i] in ("Soru", "Açıklama"):
        i += 1
    mapping = [
        (re.compile(r"^Ne \(What\)"), "ne"),
        (re.compile(r"^Nerede \(Where\)"), "nerede"),
        (re.compile(r"^Ne Zaman \(When\)"), "neZaman"),
        (re.compile(r"^Kim \(Who\)"), "kim"),
        (re.compile(r"^Nasıl \(How\)"), "nasil"),
        (re.compile(r"^Neden Önemli"), "neden"),
    ]
    out: Dict[str, str] = {}
    for pat, key in mapping:
        if i < len(lines) and pat.search(lines[i]):
            if i + 1 < len(lines):
                out[key] = lines[i + 1]
                i += 2
            else:
                i += 1
            continue
    return out, i


def parse_5why(lines: List[str], i: int) -> Tuple[Dict[str, str], int]:
    if i >= len(lines) or not lines[i].startswith("3. 5 NEDEN"):
        return {}, i
    i += 1
    while i < len(lines) and lines[i] in ("Adim", "Neden / Bulgu"):
        i += 1
    out: Dict[str, str] = {}
    # Problem
    if i < len(lines) and lines[i] == "Problem" and i + 1 < len(lines):
        out["problem"] = lines[i + 1]
        i += 2
    for n in range(1, 6):
        label = "Neden 5 (Kok Neden)" if n == 5 else f"Neden {n}"
        if i < len(lines) and lines[i] == label and i + 1 < len(lines):
            out[f"why{n}"] = lines[i + 1]
            i += 2
    extras = [
        ("Kok Neden Ozeti", "rootCause"),
        ("Anlik Aksiyon", "immediateAction"),
        ("Onleyici Aksiyon", "preventiveAction"),
    ]
    for lbl, key in extras:
        if i < len(lines) and lines[i] == lbl and i + 1 < len(lines):
            out[key] = lines[i + 1]
            i += 2
    if "rootCause" not in out and out.get("why5"):
        out["rootCause"] = out["why5"]
    return out, i


def parse_ishikawa(lines: List[str], i: int, problem_fallback: str) -> Tuple[Dict[str, Any], int]:
    if i >= len(lines) or not lines[i].startswith("4. BALIK"):
        return {"problem": problem_fallback, "man": [], "machine": [], "material": [], "measurement": [], "environment": [], "management": []}, i
    i += 1
    while i < len(lines) and lines[i] in ("6M Kategorisi", "Olasi Neden / Etken", "Risk Derecesi"):
        i += 1
    cat_map = [
        ("INSAN (Man)", "man"),
        ("MAKINE (Machine)", "machine"),
        ("METOT (Method)", "management"),
        ("MALZEME (Material)", "material"),
        ("CEVRE (Environment)", "environment"),
        ("OLCUM (Measurement)", "measurement"),
    ]
    data: Dict[str, Any] = {
        "problem": problem_fallback,
        "man": [],
        "machine": [],
        "material": [],
        "measurement": [],
        "environment": [],
        "management": [],
    }
    risks = ("Yuksek", "Orta", "Dusuk", "Düşük")
    for cat_label, key in cat_map:
        if i < len(lines) and lines[i] == cat_label:
            i += 1
            cause = ""
            if i < len(lines) and lines[i] not in cat_map and not lines[i].startswith("5."):
                cause = lines[i]
                i += 1
            if i < len(lines) and lines[i] in risks:
                i += 1
            if cause:
                data[key].append(cause)
    return data, i


def parse_fta(lines: List[str], i: int) -> Tuple[Dict[str, str], int]:
    if i >= len(lines) or not lines[i].startswith("5. FTA"):
        return {}, i
    i += 1
    while i < len(lines) and lines[i] in ("FTA Unsuru", "Aciklama"):
        i += 1
    fields = [
        "Ust Olay (Top Event)",
        "Ara Olay 1",
        "Ara Olay 2",
        "Temel Olay 1",
        "Temel Olay 2",
        "Temel Olay 3",
        "Temel Olay 4",
        "Kapi Mantigi 1",
        "Kapi Mantigi 2",
        "Analiz Ozeti",
    ]
    raw: Dict[str, str] = {}
    for lbl in fields:
        if i < len(lines) and lines[i] == lbl and i + 1 < len(lines):
            raw[lbl] = lines[i + 1]
            i += 2
        elif i < len(lines) and lines[i] == lbl:
            i += 1
    top = raw.get("Ust Olay (Top Event)", "")
    ara = []
    if raw.get("Ara Olay 1"):
        ara.append(raw["Ara Olay 1"])
    if raw.get("Ara Olay 2"):
        ara.append(raw["Ara Olay 2"])
    temel = []
    for k in ("Temel Olay 1", "Temel Olay 2", "Temel Olay 3", "Temel Olay 4"):
        if raw.get(k):
            temel.append(raw[k])
    gates = []
    if raw.get("Kapi Mantigi 1"):
        gates.append(raw["Kapi Mantigi 1"])
    if raw.get("Kapi Mantigi 2"):
        gates.append(raw["Kapi Mantigi 2"])
    fta: Dict[str, str] = {
        "topEvent": top,
        "intermediateEvents": "\n".join(ara),
        "basicEvents": "\n".join(temel),
        "gates": "\n".join(gates),
        "summary": raw.get("Analiz Ozeti", ""),
    }
    return fta, i


def parse_8d_steps(lines: List[str], i: int) -> Tuple[Dict[str, Dict[str, str]], int]:
    if i >= len(lines) or not (lines[i].startswith("6. 8D ADIMLARIM") or lines[i].startswith("8D ADIMLARIM")):
        return {}, i
    i += 1
    while i < len(lines) and lines[i] in ("8D Adimi", "Aciklama", "Sorumlu / Tarih"):
        i += 1
    steps: Dict[str, Dict[str, str]] = {}
    order = [f"D{n}" for n in range(1, 9)]
    pat = re.compile(r"^D([1-8])\s*-\s*(.+)$")
    current: Optional[str] = None
    buf: List[str] = []

    def flush():
        nonlocal current, buf
        if current and buf:
            body = "\n".join(buf).strip()
            title_match = re.match(r"^(D[1-8])\s*-\s*(.+)$", buf[0] if buf else "")
            title = title_match.group(2).strip() if title_match else ""
            steps[current] = {
                "title": title,
                "responsible": "",
                "completionDate": "",
                "description": body,
            }
        buf = []
        current = None

    while i < len(lines):
        line = lines[i]
        m = pat.match(line)
        if m:
            flush()
            current = f"D{m.group(1)}"
            buf = [line]
            i += 1
            continue
        if current:
            # stop at KADEME footer
            if line.startswith("KADEME A.Ş. KYS"):
                break
            buf.append(line)
        i += 1
    flush()
    # Ensure all D keys exist with empty description
    default_titles = {
        "D1": "Ekip Oluşturma",
        "D2": "Problemi Tanımlama",
        "D3": "Geçici Önlemler Alma",
        "D4": "Kök Neden Analizi",
        "D5": "Kalıcı Düzeltici Faaliyetleri Belirleme",
        "D6": "Kalıcı Düzeltici Faaliyetleri Uygulama",
        "D7": "Tekrarlanmayı Önleme",
        "D8": "Ekibi Takdir Etme",
    }
    for dk in order:
        if dk not in steps:
            steps[dk] = {
                "title": default_titles[dk],
                "responsible": "",
                "completionDate": "",
                "description": "",
            }
        else:
            steps[dk]["title"] = default_titles[dk]
    return steps, i


def merge_default_8d(parsed: Dict[str, Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    default_titles = {
        "D1": "Ekip Oluşturma",
        "D2": "Problemi Tanımlama",
        "D3": "Geçici Önlemler Alma",
        "D4": "Kök Neden Analizi",
        "D5": "Kalıcı Düzeltici Faaliyetleri Belirleme",
        "D6": "Kalıcı Düzeltici Faaliyetleri Uygulama",
        "D7": "Tekrarlanmayı Önleme",
        "D8": "Ekibi Takdir Etme",
    }
    out: Dict[str, Dict[str, str]] = {}
    for k in default_titles:
        p = parsed.get(k) or {}
        out[k] = {
            "title": default_titles[k],
            "responsible": p.get("responsible") or "",
            "completionDate": p.get("completionDate") or "",
            "description": p.get("description") or "",
        }
    return out


def parse_report(lines: List[str], kind: str) -> Dict[str, Any]:
    i = 0
    while i < len(lines) and not lines[i].startswith("1. TEMEL"):
        i += 1
    stop_basic = ("2. 5N1K ANALİZİ",)
    basic, i = kv_block(lines, i + 1, stop_basic)
    n1k, i = parse_5n1k(lines, i)
    why, i = parse_5why(lines, i)
    prob = basic.get("Problem Tanimi") or why.get("problem") or ""
    ish, i = parse_ishikawa(lines, i, prob)
    fta, i = parse_fta(lines, i)
    eight_d: Dict[str, Dict[str, str]] = {}
    if kind == "8D":
        e8, i = parse_8d_steps(lines, i)
        eight_d = merge_default_8d(e8)
    return {
        "basic": basic,
        "five_n1k_analysis": n1k,
        "five_why_analysis": why,
        "ishikawa_analysis": ish,
        "fta_analysis": fta,
        "eight_d_steps": eight_d if kind == "8D" else None,
    }


def sql_dollar(tag: str, payload: Any) -> str:
    body = json.dumps(payload, ensure_ascii=False)
    # PostgreSQL: $tag$ ... $tag$  (opening delimiter must end with $ before body)
    return f"${tag}$" + body + f"${tag}$"


def build_update(nc_number: str, kind: str, parsed: Dict[str, Any]) -> str:
    basic = parsed["basic"]
    dept = basic.get("Birim/Departman") or ""
    opening = basic.get("Yayın Tarihi") or ""
    # tr date dd.mm.yyyy -> ISO
    iso_date = ""
    if opening and re.match(r"^\d{2}\.\d{2}\.\d{4}$", opening.strip()):
        d, m, y = opening.strip().split(".")
        iso_date = f"{y}-{m}-{d}"
    resp = basic.get("Sorumlu Kişi") or ""
    if resp == "-":
        resp = ""
    part_name = basic.get("Parça Adı") or ""
    part_code = basic.get("Parça Kodu") or ""
    vehicle = basic.get("Araç Tipi") or ""
    prob = basic.get("Problem Tanimi") or ""
    title = (prob[:180] + "…") if len(prob) > 180 else prob
    if not title:
        title = f"{kind} {nc_number}"

    tag = "j" + secrets.token_hex(12)
    tag2 = "j" + secrets.token_hex(12)
    tag3 = "j" + secrets.token_hex(12)
    tag4 = "j" + secrets.token_hex(12)
    tag5 = "j" + secrets.token_hex(12)

    sets = [
        f"department = {sql_escape(dept)}",
        f"title = {sql_escape(title)}",
        f"description = {sql_escape(prob)}",
        f"problem_definition = {sql_escape(prob)}",
        f"responsible_person = {sql_escape(resp)}",
        f"part_name = {sql_escape(part_name)}",
        f"part_code = {sql_escape(part_code)}",
        f"vehicle_type = {sql_escape(vehicle)}",
    ]
    if iso_date:
        sets.append(f"opening_date = {sql_escape(iso_date)}")

    sets.append(f"five_n1k_analysis = {sql_dollar(tag, parsed['five_n1k_analysis'])}::jsonb")
    sets.append(f"five_why_analysis = {sql_dollar(tag + 'a', parsed['five_why_analysis'])}::jsonb")
    sets.append(f"ishikawa_analysis = {sql_dollar(tag + 'b', parsed['ishikawa_analysis'])}::jsonb")
    sets.append(f"fta_analysis = {sql_dollar(tag + 'c', parsed['fta_analysis'])}::jsonb")

    if kind == "8D" and parsed.get("eight_d_steps"):
        sets.append(f"eight_d_steps = {sql_dollar(tag + 'd', parsed['eight_d_steps'])}::jsonb")

    return f"UPDATE non_conformities SET {', '.join(sets)} WHERE nc_number = {sql_escape(nc_number)};"


def sql_escape(s: str) -> str:
    if s is None:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def main() -> None:
    docx = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else "/Users/atakanbattal/Downloads/KademeQMS_DF8D_Klasor_2026-04-14_1934/KademeQMS_DF8D_Analizleri_2026.docx"
    )
    paras = extract_paragraphs(docx)
    starts = find_report_starts(paras)
    if not starts:
        print("No report headers found", file=sys.stderr)
        sys.exit(1)

    out_sql = Path(__file__).parent / "_df8d_bulk_update_generated.sql"
    lines_out: List[str] = []
    for idx, (nc_num, kind) in enumerate([(t[1], t[2]) for t in starts]):
        section = slice_section(paras, starts, idx)
        try:
            parsed = parse_report(section, kind)
            lines_out.append(build_update(nc_num, kind, parsed))
        except Exception as e:
            print(f"FAIL {nc_num}: {e}", file=sys.stderr)
            raise

    out_sql.write_text("\n".join(lines_out) + "\n", encoding="utf-8")
    print(f"Wrote {len(lines_out)} statements to {out_sql}")


if __name__ == "__main__":
    main()
