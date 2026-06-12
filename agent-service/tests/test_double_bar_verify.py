# -*- coding: utf-8 -*-
"""Quick verification of FW{1,2} double-bar DSML fixes."""
import json, re, sys, uuid

FW = '｜'  # fullwidth vertical bar
FS = '／'  # fullwidth solidus

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

# ====== Simulate the FIXED functions ======

def _parse_dsml_params_fullwidth(params_xml):
    args = {}
    block_re = re.compile(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}parameter(\s+[^>]*)>'
        + r'(.*?)'
        + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}parameter>',
        re.DOTALL,
    )
    for attrs_str, val in block_re.findall(params_xml):
        name_m = re.search(r'name="([^"]+)"', attrs_str)
        if not name_m:
            continue
        name = name_m.group(1)
        string_m = re.search(r'string="(true|false)"', attrs_str)
        is_str = string_m.group(1) == "true" if string_m else True
        val = val.strip()
        try:
            args[name] = val if is_str else json.loads(val)
        except Exception:
            args[name] = val
    return args

def _make_tc(name, args):
    return {"id": f"dsml_{uuid.uuid4().hex[:16]}", "type": "function",
            "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)}}

def _parse_dsml_tool_calls(content, valid_tool_names=None):
    tool_calls = []
    p1_invoke = re.compile(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}invoke name="([^"]+)">'
        + r'(.*?)'
        + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}invoke>',
        re.DOTALL,
    )
    for tool_name, params_xml in p1_invoke.findall(content):
        if not tool_name:
            continue
        if valid_tool_names and tool_name not in valid_tool_names:
            continue
        args = _parse_dsml_params_fullwidth(params_xml)
        tool_calls.append(_make_tc(tool_name, args))
    return tool_calls if tool_calls else None

def _strip_dsml_from_content(content):
    content = re.sub(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}tool_calls>.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}tool_calls>',
        '', content, flags=re.DOTALL,
    )
    content = re.sub(r'<DSML\s+function_calls>.*?</DSML\s+function_calls>', '', content, flags=re.DOTALL)
    content = re.sub(r'<invoke\s+name="[^"]+"\s*>.*?</invoke\s*>', '', content, flags=re.DOTALL)
    content = re.sub(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}invoke name="[^"]*">'
        + r'.*?'
        + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}invoke>',
        '', content, flags=re.DOTALL,
    )
    return content.strip()

def _classify_response_type(content):
    has_fullwidth_dsml = bool(re.search(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}(?:tool_calls|invoke)', content,
    ))
    has_ascii_dsml = '<DSML' in content
    has_invoke = 'invoke' in content and ('<invoke' in content or FW + 'invoke' in content)
    has_fw_invoke = bool(re.search(
        r'<' + FW + r'{1,2}(?:DSML' + FW + r'{1,2})?invoke', content,
    ))
    if not (has_fullwidth_dsml or has_ascii_dsml or has_invoke or has_fw_invoke):
        return "conversational"
    if has_ascii_dsml and '<DSML' in content and 'function_calls>' in content:
        return "structured_dsml"
    if has_fullwidth_dsml and re.search(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}(?:tool_calls>|invoke)', content,
    ):
        return "structured_dsml"
    if has_invoke or has_fw_invoke:
        return "suspicious_inline"
    return "conversational"

# ====== TESTS ======

FW2 = FW + FW  # ｜｜
FS2 = FS + FS  # ／／

print("=" * 60)
print("  Double-bar DSML FW{1,2} fix verification")
print("=" * 60)

# Test 1: Double-bar DSML parse
print()
print("--- Test 1: Double-bar DSML parse ---")
content1 = (
    f'<{FW2}DSML{FW2}invoke name="search_surroundings">'
    f'<{FW2}DSML{FW2}parameter name="place_name" string="true">北京邮电大学<{FS2}DSML{FW2}parameter>'
    f'<{FW2}DSML{FW2}parameter name="query" string="true">景点<{FS2}DSML{FW2}parameter>'
    f'<{FS2}DSML{FW2}invoke>'
)
result1 = _parse_dsml_tool_calls(content1)
test("1a: double-bar DSML parsed", result1 is not None and len(result1) == 1, str(result1))
if result1 and len(result1) == 1:
    args1 = json.loads(result1[0]['function']['arguments'])
    test("1b: place_name extracted", args1.get('place_name') == '北京邮电大学', json.dumps(args1, ensure_ascii=False))
    test("1c: query extracted", args1.get('query') == '景点', json.dumps(args1, ensure_ascii=False))

# Test 2: Single-bar backward compat
print()
print("--- Test 2: Single-bar backward compat ---")
content2 = (
    f'<{FW}DSML{FW}invoke name="search_places">'
    f'<{FW}DSML{FW}parameter name="keyword" string="true">故宫<{FS}DSML{FW}parameter>'
    f'<{FS}DSML{FW}invoke>'
)
result2 = _parse_dsml_tool_calls(content2)
test("2a: single-bar still parsed (no regression)", result2 is not None and len(result2) == 1, str(result2))
if result2 and len(result2) == 1:
    args2 = json.loads(result2[0]['function']['arguments'])
    test("2b: keyword extracted (no regression)", args2.get('keyword') == '故宫', json.dumps(args2, ensure_ascii=False))

# Test 3: Double-bar content stripping
print()
print("--- Test 3: Double-bar content stripping ---")
content3 = (
    '让我先查一下周边有什么...\n'
    f'<{FW2}DSML{FW2}invoke name="search_surroundings">'
    f'<{FW2}DSML{FW2}parameter name="place_name" string="true">北邮<{FS2}DSML{FW2}parameter>'
    f'<{FS2}DSML{FW2}invoke>'
)
stripped3 = _strip_dsml_from_content(content3)
test("3a: DSML stripped", FW not in stripped3 and 'invoke' not in stripped3, stripped3[:100])
test("3b: text survives", '查一下周边' in stripped3, stripped3[:100])

# Test 4: Double-bar classification
print()
print("--- Test 4: Double-bar classification ---")
content4 = (
    f'<{FW2}DSML{FW2}invoke name="search_places">'
    f'<{FW2}DSML{FW2}parameter name="keyword" string="true">火锅<{FS2}DSML{FW2}parameter>'
    f'<{FS2}DSML{FW2}invoke>'
)
r4 = _classify_response_type(content4)
test("4a: double-bar → structured_dsml", r4 == "structured_dsml", f"got: {r4}")

# Test 5: Double-bar tool_calls envelope
print()
print("--- Test 5: Double-bar tool_calls envelope ---")
content5 = (
    f'<{FW2}DSML{FW2}tool_calls>'
    f'<{FW2}DSML{FW2}invoke name="search_places">'
    f'<{FW2}DSML{FW2}parameter name="keyword" string="true">火锅<{FS2}DSML{FW2}parameter>'
    f'<{FS2}DSML{FW2}invoke>'
    f'<{FS2}DSML{FW2}tool_calls>'
)
result5 = _parse_dsml_tool_calls(content5)
test("5a: envelope parsed", result5 is not None and len(result5) == 1, str(result5))
stripped5 = _strip_dsml_from_content(content5)
test("5b: envelope stripped clean", stripped5 == '', f"'{stripped5}'")
r5 = _classify_response_type(content5)
test("5c: envelope → structured_dsml", r5 == "structured_dsml", f"got: {r5}")

# Test 6: Real-world full scenario
print()
print("--- Test 6: Real-world scenario ---")
content6 = (
    '让我先查一下周边有什么...\n'
    f'<{FW2}DSML{FW2}tool_calls>\n'
    f'<{FW2}DSML{FW2}invoke name="search_surroundings">\n'
    f'<{FW2}DSML{FW2}parameter name="place_name" string="true">北京邮电大学 海淀区<{FS2}DSML{FW2}parameter>\n'
    f'<{FW2}DSML{FW2}parameter name="query" string="true">景点 公园 商场 娱乐<{FS2}DSML{FW2}parameter>\n'
    f'<{FS2}DSML{FW2}invoke>\n'
    f'<{FS2}DSML{FW2}tool_calls>'
)
result6 = _parse_dsml_tool_calls(content6)
test("6a: real-world parse", result6 is not None and len(result6) == 1, str(result6))
if result6 and len(result6) == 1:
    tc6 = result6[0]
    args6 = json.loads(tc6['function']['arguments'])
    test("6b: tool name", tc6['function']['name'] == 'search_surroundings', tc6['function']['name'])
    test("6c: place_name", args6.get('place_name') == '北京邮电大学 海淀区', json.dumps(args6, ensure_ascii=False))
    test("6d: query", args6.get('query') == '景点 公园 商场 娱乐', json.dumps(args6, ensure_ascii=False))
stripped6 = _strip_dsml_from_content(content6)
test("6e: DSML stripped", FW not in stripped6 and 'invoke' not in stripped6, stripped6[:100])
test("6f: text survives", '查一下周边' in stripped6, stripped6[:100])
r6 = _classify_response_type(content6)
test("6g: classified as structured_dsml", r6 == "structured_dsml", f"got: {r6}")

# Summary
print()
print("=" * 60)
print(f"  RESULTS: {PASS}/{PASS+FAIL} passed, {FAIL} failed")
if FAIL == 0:
    print("  ALL DOUBLE-BAR FIXES VERIFIED!")
else:
    print(f"  {FAIL} test(s) FAILED!")
print("=" * 60)
sys.exit(0 if FAIL == 0 else 1)
