# -*- coding: utf-8 -*-
"""
DSML parser edge-case test suite — targets vulnerabilities the existing tests miss.

Key areas:
1. Attribute order reversal (name= after string=)
2. Mixed valid/invalid tool calls with whitelist
3. Fullwidth invoke without tool_calls envelope
4. _strip_dsml_from_content completeness
5. Parameter name normalization chain (DSML parse -> _normalize_args -> dispatch)
6. _classify_response_type edge cases
"""

import json
import re
import sys
import uuid

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

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

def section(title):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)

# ============================================================================
# Import the ACTUAL production functions
# ============================================================================
from app.agent.llm_client import (
    _parse_dsml_tool_calls,
    _parse_dsml_params_fullwidth,
    _parse_dsml_params_ascii,
    _classify_response_type,
    _strip_dsml_from_content,
    _extract_tool_names,
)

# Production code now defaults valid_tool_names=None → empty set (security: reject all).
# Tests that exercise DSML parsing logic (not whitelist logic) need an accept-all wrapper.
def _parse_accept_all(content: str):
    """Parse DSML accepting ALL tool names — for tests exercising parsing, not whitelist."""
    return _parse_dsml_tool_calls(content, valid_tool_names=None)  # explicitly None

# We still need explicit whitelists because production converts None to empty set.
# Provide a helper that auto-extracts tool names from the content to simulate production flow.
import re as _re_test

def _parse_any(content: str):
    """Parse DSML accepting any tool name found in the content."""
    # Extract all tool names from invoke tags (both single and double FW bar)
    FW_test = '｜'
    names = set(_re_test.findall(
        r'<' + FW_test + r'{1,2}DSML' + FW_test + r'{1,2}invoke name="([^"]+)"',
        content,
    ))
    names.update(_re_test.findall(r'<invoke\s+name="([^"]+)"', content))
    return _parse_dsml_tool_calls(content, valid_tool_names=names) if names else None

# ============================================================================
# Test 1: Attribute order reversal (name= AFTER string=)
# ============================================================================
section("Test 1: Attribute order — string= BEFORE name=")

# DeepSeek might output: <parameter string="true" name="start">value</parameter>
params_reversed = f'<{FW}DSML{FW}parameter string="true" name="start">Hangzhou<{FS}DSML{FW}parameter>'

r_a = _parse_dsml_params_fullwidth(params_reversed)
test("1a: fullwidth params with reversed attrs parsed correctly",
     r_a.get("start") == "Hangzhou",
     f"args={r_a} (expected 'start'='Hangzhou')")

# ASCII variant
params_rev_ascii = '<parameter string="true" name="from">X</parameter>'
r_b = _parse_dsml_params_ascii(params_rev_ascii)
test("1b: ASCII params with reversed attrs parsed correctly",
     r_b.get("from") == "X",
     f"args={r_b} (expected 'from'='X')")

# Mixed: some params reversed, some not
params_mixed = (
    f'<{FW}DSML{FW}parameter string="true" name="start">S<{FS}DSML{FW}parameter>\n'
    f'<{FW}DSML{FW}parameter name="end" string="true">E<{FS}DSML{FW}parameter>'
)
r_c = _parse_dsml_params_fullwidth(params_mixed)
test("1c: mixed attr order (one reversed, one normal)",
     r_c.get("start") == "S" and r_c.get("end") == "E",
     f"args={r_c}")

# ============================================================================
# Test 2: Whitelist filtering with mixed valid/invalid tools
# ============================================================================
section("Test 2: Whitelist filtering — mixed valid/invalid tool calls")

# Simulate: DeepSeek outputs plan_shortest_path (banned) + get_foods_by_place (allowed)
dsml_mixed = (
    f'<{FW}DSML{FW}invoke name="plan_shortest_path">\n'
    f'<{FW}DSML{FW}parameter name="start" string="true">A<{FS}DSML{FW}parameter>\n'
    f'<{FS}DSML{FW}invoke>\n'
    f'<{FW}DSML{FW}invoke name="get_foods_by_place">\n'
    f'<{FW}DSML{FW}parameter name="place_name" string="true">B<{FS}DSML{FW}parameter>\n'
    f'<{FS}DSML{FW}invoke>'
)

whitelist = {"get_foods_by_place", "get_nearest_facilities"}
r_mixed = _parse_dsml_tool_calls(dsml_mixed, valid_tool_names=whitelist)
test("2a: whitelist filters banned tool, keeps allowed tool",
     r_mixed is not None and len(r_mixed) == 1,
     f"result={r_mixed}")
if r_mixed and len(r_mixed) == 1:
    tc = r_mixed[0]
    args = json.loads(tc['function']['arguments'])
    test("2b: allowed tool has correct args",
         tc['function']['name'] == 'get_foods_by_place' and args.get('place_name') == 'B',
         f"name={tc['function']['name']}, args={args}")

# All banned tools
dsml_all_banned = (
    f'<{FW}DSML{FW}invoke name="plan_shortest_path">\n'
    f'<{FW}DSML{FW}parameter name="start" string="true">A<{FS}DSML{FW}parameter>\n'
    f'<{FS}DSML{FW}invoke>\n'
    f'<{FW}DSML{FW}invoke name="plan_shortest_path">\n'
    f'<{FW}DSML{FW}parameter name="start" string="true">B<{FS}DSML{FW}parameter>\n'
    f'<{FS}DSML{FW}invoke>'
)
r_all_banned = _parse_dsml_tool_calls(dsml_all_banned, valid_tool_names=whitelist)
test("2c: all-banned DSML returns None",
     r_all_banned is None,
     f"result={r_all_banned}")

# ============================================================================
# Test 3: _strip_dsml_from_content — fullwidth invoke without envelope
# ============================================================================
section("Test 3: DSML content stripping completeness")

# Fullwidth invoke WITHOUT tool_calls wrapper (standalone)
standalone_fw = (
    f"Here is some text. "
    f'<{FW}DSML{FW}invoke name="plan_shortest_path">'
    f'<{FW}DSML{FW}parameter name="start" string="true">A<{FS}DSML{FW}parameter>'
    f'<{FS}DSML{FW}invoke>'
    f" More text after."
)
stripped = _strip_dsml_from_content(standalone_fw)
has_fw_remnant = FW in stripped or 'invoke' in stripped
test("3a: standalone fullwidth invoke stripped from content",
     not has_fw_remnant,
     f"stripped contains DSML remnants: '{stripped[:100]}'")

# ASCII invoke WITHOUT DSML wrapper
standalone_ascii = (
    'Some text. <invoke name="plan_shortest_path">'
    '<parameter name="start" string="true">A</parameter>'
    '</invoke> More text.'
)
stripped2 = _strip_dsml_from_content(standalone_ascii)
has_ascii_remnant = '<invoke' in stripped2 or '</invoke>' in stripped2
test("3b: standalone ASCII invoke stripped from content",
     not has_ascii_remnant,
     f"stripped contains DSML remnants: '{stripped2[:100]}'")

# Fullwidth tool_calls ENVELOPE with content
envelope_fw = (
    f'<{FW}DSML{FW}tool_calls>\n'
    f'<{FW}DSML{FW}invoke name="get_foods_by_place">\n'
    f'<{FW}DSML{FW}parameter name="place_name" string="true">X<{FS}DSML{FW}parameter>\n'
    f'<{FS}DSML{FW}invoke>\n'
    f'<{FS}DSML{FW}tool_calls>'
)
stripped3 = _strip_dsml_from_content(envelope_fw)
test("3c: fullwidth tool_calls envelope stripped",
     FW not in stripped3,
     f"stripped: '{stripped3}'")

# Multiple DSML blocks
multi_dsml = (
    f'<{FW}DSML{FW}tool_calls><{FW}DSML{FW}invoke name="t1">xx<{FS}DSML{FW}invoke><{FS}DSML{FW}tool_calls>'
    f' normal text '
    f'<DSML function_calls><invoke name="t2">yy</invoke></DSML function_calls>'
)
stripped4 = _strip_dsml_from_content(multi_dsml)
test("3d: multiple DSML blocks all stripped",
     stripped4.strip() == "normal text",
     f"stripped: '{stripped4}'")

# ============================================================================
# Test 4: _classify_response_type edge cases
# ============================================================================
section("Test 4: Response classification edge cases")

# Normal conversational text
r = _classify_response_type("Hello, I can help you plan your trip!")
test("4a: plain text -> conversational", r == "conversational")

# Fullwidth DSML with tool_calls
r = _classify_response_type(
    f'<{FW}DSML{FW}tool_calls><{FW}DSML{FW}invoke name="t">x<{FS}DSML{FW}invoke><{FS}DSML{FW}tool_calls>'
)
test("4b: fullwidth tool_calls -> structured_dsml", r == "structured_dsml")

# Standalone fullwidth invoke (no tool_calls wrapper)
r = _classify_response_type(
    f'<{FW}DSML{FW}invoke name="t">x<{FS}DSML{FW}invoke>'
)
test("4c: standalone fullwidth invoke -> structured_dsml", r == "structured_dsml")

# ASCII DSML function_calls
r = _classify_response_type(
    '<DSML function_calls><invoke name="t">x</invoke></DSML function_calls>'
)
test("4d: ASCII DSML wrapper -> structured_dsml", r == "structured_dsml")

# invoke in text WITHOUT DSML envelope (LLM hallucination in conversation)
r = _classify_response_type(
    'You can use <invoke name="search_places"> to search for places.'
)
test("4e: inline invoke hallucination -> suspicious_inline", r == "suspicious_inline")

# Text with just '｜' character (Chinese punctuation, not DSML)
r = _classify_response_type(
    "杭州｜西湖｜断桥残雪 这几个地方都很值得去"
)
test("4f: Chinese punctuation pipe, no DSML -> conversational",
     r == "conversational",
     f"got: {r}")

# Text with 'DSML' mentioned in conversation (LLM talking ABOUT DSML)
r = _classify_response_type(
    "I will use DSML format to call the tool."
)
test("4g: 'DSML' mentioned in conversation without tags -> conversational",
     r == "conversational",
     f"got: {r}")

# ============================================================================
# Test 5: Parameter name normalization chain
# ============================================================================
section("Test 5: End-to-end param normalization (DSML parse -> dispatch)")

from app.tools.registry import registry
from app.agent.route_agent import RouteAgent

# Ensure RouteAgent tools are registered
RouteAgent()

def simulate_dsml_to_dispatch(dsml_content, whitelist=None):
    """Full pipeline: DSML parse -> normalize -> dispatch."""
    if whitelist is None:
        whitelist = {"plan_shortest_path", "get_foods_by_place", "get_nearest_facilities",
                     "recommend_places", "plan_multi_dest"}
    tool_calls = _parse_dsml_tool_calls(dsml_content, valid_tool_names=whitelist)
    if not tool_calls:
        return None, "DSML_parse_failed"
    results = []
    for tc in tool_calls:
        name = tc['function']['name']
        args = json.loads(tc['function']['arguments'])
        result = registry.dispatch(name, args)
        results.append({"name": name, "args": args, "result": json.loads(result)})
    return tool_calls, results

# Case 5a: DSML uses "start"/"end" (DeepSeek convention) -> _normalize_args maps to from_place/to_place
dsml_start_end = (
    f'<{FW}DSML{FW}invoke name="plan_shortest_path">'
    f'<{FW}DSML{FW}parameter name="start" string="true">A<{FS}DSML{FW}parameter>'
    f'<{FW}DSML{FW}parameter name="end" string="true">B<{FS}DSML{FW}parameter>'
    f'<{FS}DSML{FW}invoke>'
)
tcs, results = simulate_dsml_to_dispatch(dsml_start_end)
if tcs:
    r = results[0]
    ok = r['result'].get('ok', False)
    error = r['result'].get('error', '')
    test("5a: DSML 'start'/'end' -> normalize -> dispatch OK",
         ok or ('from_place' not in error and 'to_place' not in error),
         f"result={json.dumps(r['result'], ensure_ascii=False)[:100]}")
else:
    test("5a: DSML 'start'/'end' -> normalize -> dispatch OK",
         False, f"DSML parse returned: {results}")

# Case 5b: DSML uses "from_place"/"to_place" (correct names from schema)
dsml_correct = (
    f'<{FW}DSML{FW}invoke name="plan_shortest_path">'
    f'<{FW}DSML{FW}parameter name="from_place" string="true">C<{FS}DSML{FW}parameter>'
    f'<{FW}DSML{FW}parameter name="to_place" string="true">D<{FS}DSML{FW}parameter>'
    f'<{FS}DSML{FW}invoke>'
)
tcs2, results2 = simulate_dsml_to_dispatch(dsml_correct)
if tcs2:
    r = results2[0]
    test("5b: DSML 'from_place'/'to_place' -> dispatch OK",
         r['result'].get('ok', False),
         f"result={json.dumps(r['result'], ensure_ascii=False)[:150]}")
else:
    test("5b: DSML 'from_place'/'to_place' -> dispatch OK",
         False, f"DSML parse returned: {results2}")

# Case 5c: Empty args (simulating DSML parse failure)
empty_result = registry.dispatch("plan_shortest_path", {})
parsed_empty = json.loads(empty_result)
test("5c: empty args dispatch returns error JSON",
     parsed_empty.get('ok') == False,
     f"result={empty_result}")

# ============================================================================
# Test 6: DeepSeek response format variants
# ============================================================================
section("Test 6: DeepSeek response format variants")

# 6a: Parameters separated by newlines
dsml_newlines = (
    f'<{FW}DSML{FW}invoke name="plan_shortest_path">\n'
    f'  <{FW}DSML{FW}parameter name="from_place" string="true">\n'
    f'    Hangzhou\n'
    f'  <{FS}DSML{FW}parameter>\n'
    f'  <{FW}DSML{FW}parameter name="to_place" string="true">\n'
    f'    WestLake\n'
    f'  <{FS}DSML{FW}parameter>\n'
    f'<{FS}DSML{FW}invoke>'
)
tcs3 = _parse_any(dsml_newlines)
has_newline_params = tcs3 is not None and len(tcs3) == 1
if has_newline_params:
    args = json.loads(tcs3[0]['function']['arguments'])
    has_newline_params = (args.get('from_place', '').strip() == 'Hangzhou' and
                          args.get('to_place', '').strip() == 'WestLake')
test("6a: multi-line param values parsed correctly", has_newline_params,
     f"tcs={tcs3}")

# 6b: Parameters with extra whitespace
dsml_whitespace = (
    f'<{FW}DSML{FW}invoke name="plan_shortest_path">'
    f'<{FW}DSML{FW}parameter  name="from_place"  string="true" >Hangzhou<{FS}DSML{FW}parameter>'
    f'<{FS}DSML{FW}invoke>'
)
tcs4 = _parse_any(dsml_whitespace)
test("6b: extra whitespace in attributes parsed correctly",
     tcs4 is not None and len(tcs4) == 1,
     f"tcs={tcs4}")

# 6c: Multiple invoke tags with NO newlines between them (concatenated)
dsml_concat = ''.join(
    f'<{FW}DSML{FW}invoke name="t{i}">'
    f'<{FW}DSML{FW}parameter name="p" string="true">v{i}<{FS}DSML{FW}parameter>'
    f'<{FS}DSML{FW}invoke>'
    for i in range(3)
)
tcs5 = _parse_any(dsml_concat)
test("6c: concatenated invoke tags (no separator)",
     tcs5 is not None and len(tcs5) == 3,
     f"tcs count={len(tcs5) if tcs5 else 0}")

# ============================================================================
# Test 7: Valid tool_names=None edge case
# ============================================================================
section("Test 7: valid_tool_names=None behavior")

dsml_test = (
    f'<{FW}DSML{FW}invoke name="plan_shortest_path">'
    f'<{FW}DSML{FW}parameter name="from_place" string="true">A<{FS}DSML{FW}parameter>'
    f'<{FS}DSML{FW}invoke>'
)

# When valid_tool_names is explicitly None → treated as "no tools available" (security: reject all)
r_none = _parse_dsml_tool_calls(dsml_test, valid_tool_names=None)
test("7a: valid_tool_names=None rejects all (security — no tools available)",
     r_none is None,
     f"result={r_none}")

# When valid_tool_names is empty set, all tools rejected
r_empty = _parse_dsml_tool_calls(dsml_test, valid_tool_names=set())
test("7b: valid_tool_names=empty rejects all tools",
     r_empty is None,
     f"result={r_empty}")

# ============================================================================
# Test 8: JSON in parameter values
# ============================================================================
section("Test 8: Complex parameter values")

# Array parameter (like place_names for plan_multi_dest)
dsml_array = (
    f'<{FW}DSML{FW}invoke name="plan_multi_dest">'
    f'<{FW}DSML{FW}parameter name="place_names" string="false">'
    f'["A","B","C"]'
    f'<{FS}DSML{FW}parameter>'
    f'<{FS}DSML{FW}invoke>'
)
tcs_arr = _parse_any(dsml_array)
has_array = tcs_arr is not None and len(tcs_arr) == 1
if has_array:
    args = json.loads(tcs_arr[0]['function']['arguments'])
    has_array = isinstance(args.get('place_names'), list)
test("8a: JSON array param (string=false) parsed as list",
     has_array,
     f"args={args if has_array else 'N/A'}")

# ============================================================================
# Test 9: Double fullwidth bar — DeepSeek real-world 2x FW output
# ============================================================================
section("Test 9: Double fullwidth bar (DeepSeek real output)")

FW2 = FW + FW  # ｜｜
FS2 = FS + FS  # ／／

# 9a: Parse double-bar DSML invoke (full format)
dsml_double_invoke = (
    f'<{FW2}DSML{FW2}invoke name="search_surroundings">'
    f'<{FW2}DSML{FW2}parameter name="place_name" string="true">北京邮电大学<{FS2}DSML{FW2}parameter>'
    f'<{FW2}DSML{FW2}parameter name="query" string="true">景点<{FS2}DSML{FW2}parameter>'
    f'<{FS2}DSML{FW2}invoke>'
)
tcs_double = _parse_any(dsml_double_invoke)
has_double = tcs_double is not None and len(tcs_double) == 1
test("9a: double FW bar DSML invoke parsed correctly",
     has_double,
     f"tcs={tcs_double}")
if has_double:
    args9a = json.loads(tcs_double[0]['function']['arguments'])
    test("9b: double FW bar — place_name extracted",
         args9a.get('place_name') == '北京邮电大学',
         f"args={json.dumps(args9a, ensure_ascii=False)}")
    test("9c: double FW bar — query extracted",
         args9a.get('query') == '景点',
         f"args={json.dumps(args9a, ensure_ascii=False)}")

# 9d: Double-bar DSML with tool_calls envelope
dsml_double_envelope = (
    f'<{FW2}DSML{FW2}tool_calls>'
    f'<{FW2}DSML{FW2}invoke name="search_places">'
    f'<{FW2}DSML{FW2}parameter name="keyword" string="true">火锅<{FS2}DSML{FW2}parameter>'
    f'<{FS2}DSML{FW2}invoke>'
    f'<{FS2}DSML{FW2}tool_calls>'
)
tcs_envelope = _parse_any(dsml_double_envelope)
test("9d: double FW bar tool_calls envelope parsed",
     tcs_envelope is not None and len(tcs_envelope) == 1,
     f"tcs={tcs_envelope}")
if tcs_envelope and len(tcs_envelope) == 1:
    args9d = json.loads(tcs_envelope[0]['function']['arguments'])
    test("9e: double FW bar envelope — keyword extracted",
         args9d.get('keyword') == '火锅',
         f"args={json.dumps(args9d, ensure_ascii=False)}")

# 9f: Double-bar classification
r9f = _classify_response_type(dsml_double_invoke)
test("9f: double FW bar invoke → structured_dsml", r9f == "structured_dsml", f"got: {r9f}")

r9g = _classify_response_type(dsml_double_envelope)
test("9g: double FW bar envelope → structured_dsml", r9g == "structured_dsml", f"got: {r9g}")

# 9h: Double-bar content stripping
stripped9h = _strip_dsml_from_content(dsml_double_envelope)
test("9h: double FW bar DSML stripped from content",
     FW not in stripped9h,
     f"stripped: '{stripped9h[:100]}'")

# 9i: Mixed content — text + double-bar DSML
mixed_double = (
    '让我先查一下周边有什么...\n'
    f'<{FW2}DSML{FW2}invoke name="search_surroundings">'
    f'<{FW2}DSML{FW2}parameter name="place_name" string="true">北邮<{FS2}DSML{FW2}parameter>'
    f'<{FS2}DSML{FW2}invoke>'
)
stripped9i = _strip_dsml_from_content(mixed_double)
test("9i: mixed text + double-bar DSML — text survives, DSML stripped",
     '查一下周边' in stripped9i and FW not in stripped9i,
     f"stripped: '{stripped9i[:120]}'")

# 9j: Backward compatibility — single FW bar still works
dsml_single = (
    f'<{FW}DSML{FW}invoke name="search_places">'
    f'<{FW}DSML{FW}parameter name="keyword" string="true">故宫<{FS}DSML{FW}parameter>'
    f'<{FS}DSML{FW}invoke>'
)
tcs_single = _parse_any(dsml_single)
test("9j: single FW bar still parsed (no regression)",
     tcs_single is not None and len(tcs_single) == 1,
     f"tcs={tcs_single}")
if tcs_single and len(tcs_single) == 1:
    args9j = json.loads(tcs_single[0]['function']['arguments'])
    test("9k: single FW bar — keyword extracted (no regression)",
         args9j.get('keyword') == '故宫',
         f"args={json.dumps(args9j, ensure_ascii=False)}")

# 9l: Complete real-world scenario simulation — "北邮附近有什么好玩的"
dsml_real_world = (
    '让我先查一下周边有什么...\n'
    f'<{FW2}DSML{FW2}tool_calls>\n'
    f'<{FW2}DSML{FW2}invoke name="search_surroundings">\n'
    f'<{FW2}DSML{FW2}parameter name="place_name" string="true">北京邮电大学 海淀区<{FS2}DSML{FW2}parameter>\n'
    f'<{FW2}DSML{FW2}parameter name="query" string="true">景点 公园 商场 娱乐<{FS2}DSML{FW2}parameter>\n'
    f'<{FS2}DSML{FW2}invoke>\n'
    f'<{FS2}DSML{FW2}tool_calls>'
)
# Parse
tcs_real = _parse_any(dsml_real_world)
test("9l: real-world double-bar scenario — parsed correctly",
     tcs_real is not None and len(tcs_real) == 1,
     f"tcs={tcs_real}")
if tcs_real and len(tcs_real) == 1:
    tc = tcs_real[0]
    args_real = json.loads(tc['function']['arguments'])
    test("9m: real-world — tool name is search_surroundings",
         tc['function']['name'] == 'search_surroundings',
         f"name={tc['function']['name']}")
    test("9n: real-world — place_name extracted",
         args_real.get('place_name') == '北京邮电大学 海淀区',
         f"args={json.dumps(args_real, ensure_ascii=False)}")
    test("9o: real-world — query extracted",
         args_real.get('query') == '景点 公园 商场 娱乐',
         f"args={json.dumps(args_real, ensure_ascii=False)}")
# Strip
stripped_real = _strip_dsml_from_content(dsml_real_world)
test("9p: real-world — DSML fully stripped, text survives",
     '查一下周边' in stripped_real and FW not in stripped_real and 'invoke' not in stripped_real,
     f"stripped: '{stripped_real[:150]}'")

# 9q: Classify real-world double-bar scenario
r9q = _classify_response_type(dsml_real_world)
test("9q: real-world double-bar → structured_dsml", r9q == "structured_dsml", f"got: {r9q}")

# ============================================================================
# Summary
# ============================================================================
print()
print("=" * 60)
print(f"  RESULTS: {PASS}/{PASS+FAIL} passed, {FAIL} failed")
if FAIL == 0:
    print("  ALL EDGE CASE TESTS PASSED")
else:
    print(f"  {FAIL} EDGE CASE(S) FAILED — INVESTIGATE ABOVE")
print("=" * 60)
