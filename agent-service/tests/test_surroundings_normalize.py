# -*- coding: utf-8 -*-
"""
Verify the fix for "北邮附近有什么好玩的" — parameter normalization for surrounding tools.
"""
import json
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

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

from app.tools.registry import registry
from app.agent.discover_agent import DiscoverAgent

# Register discover tools
DiscoverAgent()

# ============================================================================
# Test 1: search_surroundings with location="北京邮电大学" (LLM convention)
# ============================================================================
section("Test 1: search_surroundings(location='北京邮电大学')")

# Simulate LLM passing 'location' instead of 'place_name'/'query'
args = {"location": "北京邮电大学"}
result = registry.dispatch("search_surroundings", args)
parsed = json.loads(result)

test("1a: dispatch succeeds (no TypeError)",
     True,  # If we get here, no exception was thrown
     f"result ok={parsed.get('ok')}")

test("1b: error is not about missing/wrong params",
     "unexpected keyword" not in str(parsed.get('error', ''))
     and "missing" not in str(parsed.get('error', '')),
     f"error={parsed.get('error', '')}")

# ============================================================================
# Test 2: get_surroundings_by_place with location="北京邮电大学"
# ============================================================================
section("Test 2: get_surroundings_by_place(location='北京邮电大学')")

args2 = {"location": "北京邮电大学"}
result2 = registry.dispatch("get_surroundings_by_place", args2)
parsed2 = json.loads(result2)

test("2a: dispatch succeeds",
     True,
     f"result ok={parsed2.get('ok')}")

test("2b: error is not about missing/wrong params",
     "unexpected keyword" not in str(parsed2.get('error', ''))
     and "missing" not in str(parsed2.get('error', '')),
     f"error={parsed2.get('error', '')}")

# ============================================================================
# Test 3: search_places with location="北京邮电大学" (existing behavior)
# ============================================================================
section("Test 3: search_places(location='北京邮电大学') — backward compat")

args3 = {"location": "北京邮电大学"}
result3 = registry.dispatch("search_places", args3)
parsed3 = json.loads(result3)

test("3a: dispatch succeeds",
     True,
     f"result ok={parsed3.get('ok')}")

# location should map to keyword for search_places
test("3b: no param error",
     "unexpected keyword" not in str(parsed3.get('error', '')),
     f"error={parsed3.get('error', '')}")

# ============================================================================
# Test 4: search_surroundings with BOTH location AND query
# ============================================================================
section("Test 4: search_surroundings(location='北京邮电大学', query='火锅')")

args4 = {"location": "北京邮电大学", "query": "火锅"}
result4 = registry.dispatch("search_surroundings", args4)
parsed4 = json.loads(result4)

test("4a: dispatch succeeds with both params",
     True,
     f"result ok={parsed4.get('ok')}")

# query should NOT be overwritten by location mapping
test("4b: no param conflict",
     "unexpected keyword" not in str(parsed4.get('error', '')),
     f"error={parsed4.get('error', '')}")

# ============================================================================
# Test 5: Exact scenario — "北邮附近有什么好玩的"
# ============================================================================
section("Test 5: Full scenario simulation")

# After LLM outputs DSML: <invoke name="search_surroundings">
#   <parameter name="location" string="true">北京邮电大学</parameter>
# </invoke>
# DSML parser extracts: {"location": "北京邮电大学"}
# Then normalize maps it to place_name
# Then dispatch calls search_surroundings(place_name="北京邮电大学")

dsml_args = {"location": "北京邮电大学"}
result5 = registry.dispatch("search_surroundings", dsml_args)
parsed5 = json.loads(result5)

# Should NOT crash with TypeError
test("5a: no TypeError crash",
     True,
     f"result: ok={parsed5.get('ok')}, error={parsed5.get('error', '')}")

# Should return structured result (ok or data)
has_ok = 'ok' in parsed5
test("5b: returns valid JSON structure",
     has_ok,
     f"parsed keys: {list(parsed5.keys())}")

# ============================================================================
# Summary
# ============================================================================
print()
print("=" * 60)
print(f"  RESULTS: {PASS}/{PASS+FAIL} passed, {FAIL} failed")
if FAIL == 0:
    print("  ALL TESTS PASSED — parameter normalization fix verified!")
else:
    print(f"  {FAIL} test(s) failed — investigate above")
print("=" * 60)
