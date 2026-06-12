"""
DSML 解析漏洞验证测试 — 验证报告中的 5 个漏洞。
"""
from app.agent.llm_client import _parse_dsml_tool_calls
import json

FW = '｜'  # ｜
FS = '／'  # ／

# Helper: production code defaults valid_tool_names=None -> empty set (reject all).
# Tests must pass an explicit whitelist to exercise parsing logic.
_WHITELIST = {"plan_shortest_path"}

def test_standard_dsml():
    """测试 1: 标准全角 DSML（带 string 属性）"""
    tc = f'<{FW}DSML{FW}invoke name="plan_shortest_path">\n<{FW}DSML{FW}parameter name="start" string="true">断桥残雪<{FS}DSML{FW}parameter>\n<{FW}DSML{FW}parameter name="end" string="true">白堤<{FS}DSML{FW}parameter>\n<{FS}DSML{FW}invoke>'
    r = _parse_dsml_tool_calls(tc, valid_tool_names=_WHITELIST)
    assert r is not None, "standard DSML should parse"
    assert len(r) == 1, f"expected 1 tool_call, got {len(r)}"
    args = json.loads(r[0]['function']['arguments'])
    assert args.get('start') == '断桥残雪', f"start arg error: {args}"
    assert args.get('end') == '白堤', f"end arg error: {args}"
    print("[PASS] Test 1: standard DSML parsed correctly")

def test_no_string_attr():
    """测试 2: 无 string 属性的参数"""
    tc = f'<{FW}DSML{FW}invoke name="plan_shortest_path">\n<{FW}DSML{FW}parameter name="start">断桥残雪<{FS}DSML{FW}parameter>\n<{FW}DSML{FW}parameter name="end">白堤<{FS}DSML{FW}parameter>\n<{FS}DSML{FW}invoke>'
    r = _parse_dsml_tool_calls(tc, valid_tool_names=_WHITELIST)
    if r is None:
        print("[FAIL] Test 2: no-string-attr DSML returned None -> LLM output treated as text!")
        return False
    if len(r) == 1:
        args = json.loads(r[0]['function']['arguments'])
        if not args:
            print("[FAIL] Test 2: args empty -> tool call will fail with missing params!")
            return False
        else:
            print(f"[PASS] Test 2: args={args}")
            return True
    return False

def test_ascii_no_string():
    """测试 3: ASCII DSML 无 string 属性"""
    tc = '<invoke name="plan_shortest_path">\n<parameter name="start">断桥残雪</parameter>\n<parameter name="end">白堤</parameter>\n</invoke>'
    r = _parse_dsml_tool_calls(tc, valid_tool_names=_WHITELIST)
    if r is None or len(r) == 0:
        print("[FAIL] Test 3: ASCII DSML no-string-attr parse failed!")
        return False
    args = json.loads(r[0]['function']['arguments'])
    if not args:
        print("[FAIL] Test 3: args empty!")
        return False
    print(f"[PASS] Test 3: args={args}")
    return True

def test_parallel_calls():
    """测试 4: 8 个并行调用"""
    spots = [
        ('断桥残雪', '白堤'), ('白堤', '平湖秋月'), ('平湖秋月', '曲院风荷'),
        ('曲院风荷', '苏堤春晓'), ('苏堤春晓', '花港观鱼'), ('花港观鱼', '雷峰夕照'),
        ('雷峰夕照', '柳浪闻莺'), ('柳浪闻莺', '湖滨公园'),
    ]
    parts = []
    for s, e in spots:
        parts.append(
            f'<{FW}DSML{FW}invoke name="plan_shortest_path">\n'
            f'<{FW}DSML{FW}parameter name="start" string="true">{s}<{FS}DSML{FW}parameter>\n'
            f'<{FW}DSML{FW}parameter name="end" string="true">{e}<{FS}DSML{FW}parameter>\n'
            f'<{FS}DSML{FW}invoke>'
        )
    tc = ''.join(parts)
    r = _parse_dsml_tool_calls(tc, valid_tool_names=_WHITELIST)
    assert r is not None, "parallel DSML should parse"
    assert len(r) == 8, f"expected 8 tool_calls, got {len(r)}"
    for i, tc_item in enumerate(r):
        args = json.loads(tc_item['function']['arguments'])
        assert args.get('start') == spots[i][0], f"#{i+1} start arg error"
        assert args.get('end') == spots[i][1], f"#{i+1} end arg error"
    print(f"[PASS] Test 4: {len(r)} parallel calls parsed correctly")

def test_empty_args_handling():
    """测试 5: DSML 解析失败后 args 为空 -> dispatch"""
    from app.tools.registry import registry
    from app.agent.route_agent import RouteAgent
    RouteAgent()  # ensure tools registered

    result = registry.dispatch("plan_shortest_path", {})
    parsed = json.loads(result)
    if parsed.get('ok') == False:
        print(f"[PASS] Test 5: empty args returns error: {parsed.get('error', '')[:80]}")
    else:
        print(f"[WARN] Test 5: empty args returned ok=True: {str(result)[:100]}")

if __name__ == '__main__':
    print("=" * 60)
    print("DSML parsing verification test suite")
    print("=" * 60)

    results = []
    try:
        test_standard_dsml()
        results.append(True)
    except Exception as e:
        print(f"[FAIL] Test 1 ERROR: {e}")
        results.append(False)

    results.append(test_no_string_attr())
    results.append(test_ascii_no_string())

    try:
        test_parallel_calls()
        results.append(True)
    except Exception as e:
        print(f"[FAIL] Test 4 ERROR: {e}")
        results.append(False)

    try:
        test_empty_args_handling()
        results.append(True)
    except Exception as e:
        print(f"[FAIL] Test 5 ERROR: {e}")
        results.append(False)

    print("=" * 60)
    passed = sum(1 for r in results if r)
    print(f"Results: {passed}/{len(results)} passed, {len(results) - passed} failed")
