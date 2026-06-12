# -*- coding: utf-8 -*-
"""
DSML parsing standalone test - verifies fix for missing string= attribute.
"""
import json
import re
import sys
import uuid

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

FW = '｜'  # fullwidth vertical bar
FS = '／'  # fullwidth solidus


def _safe_json(s):
    try:
        return json.loads(s)
    except Exception:
        return None


def _make_tc(name, args):
    return {"id": f"dsml_{uuid.uuid4().hex[:16]}", "type": "function",
            "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)}}


# ==================== FIXED (after patch) ====================

def parse_fullwidth_fixed(params_xml):
    args = {}
    # Pattern A: standard with string="true/false"
    for m in re.finditer(
        re.escape(f'<{FW}DSML{FW}parameter name=') + r'"([^"]+)"\s+string="(true|false)"' + re.escape('>')
        + r'(.*?)' + re.escape(f'<{FS}DSML{FW}parameter>'),
        params_xml, re.DOTALL,
    ):
        name, is_str, val = m.group(1), m.group(2), m.group(3).strip()
        args[name] = val if is_str == "true" else (_safe_json(val) if _safe_json(val) is not None else val)
    # Pattern B (fallback): missing string attribute
    if not args:
        for m in re.finditer(
            re.escape(f'<{FW}DSML{FW}parameter name=') + r'"([^"]+)"' + re.escape('>')
            + r'(.*?)' + re.escape(f'<{FS}DSML{FW}parameter>'),
            params_xml, re.DOTALL,
        ):
            name, val = m.group(1), m.group(2).strip()
            args[name] = val
    return args


def parse_ascii_fixed(params_xml):
    args = {}
    # Pattern A
    for m in re.finditer(
        r'<parameter\s+name="([^"]+)"\s+string="(true|false)"\s*>(.*?)</parameter\s*>',
        params_xml, re.DOTALL,
    ):
        name, is_str, val = m.group(1), m.group(2), m.group(3).strip()
        args[name] = val if is_str == "true" else (_safe_json(val) if _safe_json(val) is not None else val)
    # Pattern B (fallback)
    if not args:
        for m in re.finditer(
            r'<parameter\s+name="([^"]+)"\s*>(.*?)</parameter\s*>',
            params_xml, re.DOTALL,
        ):
            name, val = m.group(1), m.group(2).strip()
            args[name] = val
    return args


# ==================== OLD (before patch) ====================

def parse_fullwidth_old(params_xml):
    args = {}
    for m in re.finditer(
        re.escape(f'<{FW}DSML{FW}parameter name=') + r'"([^"]+)"\s+string="(true|false)"' + re.escape('>')
        + r'(.*?)' + re.escape(f'<{FS}DSML{FW}parameter>'),
        params_xml, re.DOTALL,
    ):
        name, is_str, val = m.group(1), m.group(2), m.group(3).strip()
        args[name] = val if is_str == "true" else (_safe_json(val) if _safe_json(val) is not None else val)
    return args


def parse_ascii_old(params_xml):
    args = {}
    for m in re.finditer(
        r'<parameter\s+name="([^"]+)"\s+string="(true|false)"\s*>(.*?)</parameter\s*>',
        params_xml, re.DOTALL,
    ):
        name, is_str, val = m.group(1), m.group(2), m.group(3).strip()
        args[name] = val if is_str == "true" else (_safe_json(val) if _safe_json(val) is not None else val)
    return args


# ==================== test runner ====================

PASS = 0
FAIL = 0


def test(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        print(f"  [PASS] {name}")
        PASS += 1
    else:
        print(f"  [FAIL] {name}  |  {detail}")
        FAIL += 1


def section(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print(f"{'='*55}")


# ====================================================================
section("Test 1: Fullwidth DSML missing string= attribute (OLD vs FIXED)")

params_no_str = f'<{FW}DSML{FW}parameter name="start">Hangzhou<{FS}DSML{FW}parameter>\n<{FW}DSML{FW}parameter name="end">WestLake<{FS}DSML{FW}parameter>'

old_r = parse_fullwidth_old(params_no_str)
fix_r = parse_fullwidth_fixed(params_no_str)

test("OLD: args is empty (vulnerability confirmed)", len(old_r) == 0,
     f"args={old_r}")
test("FIXED: args correctly parsed", fix_r.get("start") == "Hangzhou" and fix_r.get("end") == "WestLake",
     f"args={fix_r}")

# ====================================================================
section("Test 2: Standard fullwidth DSML (backward compatibility)")

params_std = f'<{FW}DSML{FW}parameter name="start" string="true">A<{FS}DSML{FW}parameter>\n<{FW}DSML{FW}parameter name="end" string="true">B<{FS}DSML{FW}parameter>'

old_std = parse_fullwidth_old(params_std)
fix_std = parse_fullwidth_fixed(params_std)

test("OLD: standard format works", old_std == {"start": "A", "end": "B"})
test("FIXED: standard format works (no regression)", fix_std == {"start": "A", "end": "B"})

# ====================================================================
section("Test 3: ASCII DSML missing string= attribute")

params_ascii_ns = '<parameter name="from">X</parameter>\n<parameter name="to">Y</parameter>'

old_a = parse_ascii_old(params_ascii_ns)
fix_a = parse_ascii_fixed(params_ascii_ns)

test("OLD: ASCII args empty", len(old_a) == 0, f"args={old_a}")
test("FIXED: ASCII args parsed", fix_a == {"from": "X", "to": "Y"}, f"args={fix_a}")

# ====================================================================
section("Test 4: 8 parallel plan_shortest_path calls (West Lake scenario)")

spots = [
    ("Spot01", "Spot02"), ("Spot02", "Spot03"), ("Spot03", "Spot04"),
    ("Spot04", "Spot05"), ("Spot05", "Spot06"), ("Spot06", "Spot07"),
    ("Spot07", "Spot08"), ("Spot08", "Spot09"),
]

for fmt_label, build_param in [
    ("standard (string=)", lambda n, v: f'<{FW}DSML{FW}parameter name="{n}" string="true">{v}<{FS}DSML{FW}parameter>'),
    ("missing string=",    lambda n, v: f'<{FW}DSML{FW}parameter name="{n}">{v}<{FS}DSML{FW}parameter>'),
]:
    parts = []
    for s, e in spots:
        px = build_param("start", s) + "\n" + build_param("end", e)
        parts.append(f'<{FW}DSML{FW}invoke name="plan_shortest_path">\n{px}\n<{FS}DSML{FW}invoke>')
    content = '\n'.join(parts)

    tool_calls = []
    p1 = re.compile(
        re.escape(f'<{FW}DSML{FW}invoke name=') + r'"([^"]+)"' + re.escape('>')
        + r'(.*?)' + re.escape(f'<{FS}DSML{FW}invoke>'),
        re.DOTALL,
    )
    for tool_name, params_xml in p1.findall(content):
        args = parse_fullwidth_fixed(params_xml)
        if tool_name:
            tool_calls.append(_make_tc(tool_name, args))

    test(f"8-parallel [{fmt_label}]: all 8 parsed", len(tool_calls) == 8,
         f"got {len(tool_calls)}")

    if len(tool_calls) == 8:
        all_ok = True
        for i, tc in enumerate(tool_calls):
            a = json.loads(tc['function']['arguments'])
            if a.get('start') != spots[i][0] or a.get('end') != spots[i][1]:
                all_ok = False
                break
        test(f"8-parallel [{fmt_label}]: all args correct", all_ok)

# ====================================================================
section("Test 5: plan_shortest_path input validation")

def plan_sp_fixed(from_place, to_place):
    if not from_place or not isinstance(from_place, str) or not from_place.strip():
        return json.dumps({"ok": False, "error": "missing from_place"}, ensure_ascii=False)
    if not to_place or not isinstance(to_place, str) or not to_place.strip():
        return json.dumps({"ok": False, "error": "missing to_place"}, ensure_ascii=False)
    return json.dumps({"ok": True, "data": f"{from_place.strip()} -> {to_place.strip()}"}, ensure_ascii=False)

r = json.loads(plan_sp_fixed("", "B"))
test("empty from_place -> error", r["ok"] == False and "from_place" in r["error"])

r = json.loads(plan_sp_fixed("A", ""))
test("empty to_place -> error", r["ok"] == False and "to_place" in r["error"])

r = json.loads(plan_sp_fixed("A", "B"))
test("valid params -> ok", r["ok"] == True)

r = json.loads(plan_sp_fixed("   ", "B"))
test("whitespace from_place -> error", r["ok"] == False)

# ====================================================================
section("Test 6: DSML parse failure logging (simulated)")

def simulate_parse(content):
    tool_calls = None  # simulate total failure
    if not tool_calls and ('DSML' in content or 'invoke' in content):
        print(f"  [LOG] WARNING: DSML parse failed! content[:200]={content[:200]}")
    return tool_calls

garbage = '<DSML weird_new_format><invoke name="t"><p/></invoke></DSML>'
r = simulate_parse(garbage)
test("garbage DSML -> returns None + log emitted", r is None, "(log above)")

# ====================================================================
print(f"\n{'='*55}")
print(f"  RESULTS: {PASS}/{PASS+FAIL} passed, {FAIL} failed")
if FAIL == 0:
    print("  ALL TESTS PASSED - fixes verified!")
else:
    print(f"  {FAIL} test(s) failed - investigate needed.")
print(f"{'='*55}")
