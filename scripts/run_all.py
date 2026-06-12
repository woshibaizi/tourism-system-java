"""
校园周边数据采集 — 一键运行入口

按顺序执行:
  1. scrape_amap.py       → 高德 API 采集原始 POI
  2. clean_and_merge.py   → 数据清洗 + 坐标转换 + 去重
  3. select_best.py       → AI 智能精选 (每校 top N)
  4. enrich_with_llm.py   → LLM 批量生成文本描述
  5. validate_data.py     → 质量校验
  6. generate_sql.py      → 输出 SQL 文件

用法:
    py scripts/run_all.py                          # 全部学校，完整流程
    py scripts/run_all.py --step 1                 # 仅运行 Step 1 (采集)
    py scripts/run_all.py --step 1 2               # 运行 Step 1+2
    py scripts/run_all.py --school place_001       # 仅处理北邮
    py scripts/run_all.py --dry-run                # 预览不调用 LLM

环境变量:
    AMAP_WEB_KEY    — 高德 Web API Key
    LLM_API_KEY     — LLM API Key
    LLM_BASE_URL    — LLM API Base URL (默认 https://api.deepseek.com)
"""

import subprocess
import sys
import os
import argparse

STEPS = {
    1: ("高德数据采集",   "scrape_amap.py"),
    2: ("数据清洗合并",   "clean_and_merge.py"),
    3: ("AI智能精选",    "select_best.py"),
    4: ("LLM文本增强",   "enrich_with_llm.py"),
    5: ("数据质量校验",   "validate_data.py"),
    6: ("SQL生成",       "generate_sql.py"),
}


def run_step(step_num, step_name, script, extra_args):
    """执行单个步骤"""
    print(f"\n{'='*60}")
    print(f"  Step {step_num}: {step_name}")
    print(f"  {'─'*50}")
    print(f"  py scripts/{script} {' '.join(extra_args)}")
    print(f"{'='*60}\n")

    cmd = [sys.executable, f"scripts/{script}"] + extra_args
    result = subprocess.run(cmd, cwd=os.getcwd())

    if result.returncode != 0:
        print(f"\n[FAIL] Step {step_num} (exit code {result.returncode})")
        return False

    print(f"\n[OK] Step {step_num} 完成")
    return True


def main():
    parser = argparse.ArgumentParser(description="校园周边数据采集一键运行")
    parser.add_argument("--step", type=int, nargs="+", choices=list(range(1, 7)),
                        help="指定运行的步骤 (1-6)")
    parser.add_argument("--school", type=str, help="仅处理指定 placeId")
    parser.add_argument("--dry-run", action="store_true", help="跳过 LLM 调用,预览模式")
    parser.add_argument("--skip-llm", action="store_true", help="跳过 LLM 文本增强")
    parser.add_argument("--start-from", type=int, choices=list(range(1, 7)),
                        help="从指定步骤开始")
    args = parser.parse_args()

    # 确定要运行的步骤
    if args.step:
        steps_to_run = [s for s in range(1, 7) if s in args.step]
    elif args.start_from:
        steps_to_run = list(range(args.start_from, 7))
    else:
        steps_to_run = list(range(1, 7))

    # 跳过 LLM
    if args.skip_llm and 4 in steps_to_run:
        steps_to_run.remove(4)

    print(f"校园周边数据采集流水线")
    print(f"步骤: {steps_to_run}")
    print(f"学校: {args.school or '全部 (config.json)'}")
    print()

    # 构建公共参数
    base_args = []
    if args.school:
        base_args.extend(["--school", args.school])
    if args.dry_run and 4 in steps_to_run:
        base_args.append("--dry-run")

    for step in steps_to_run:
        name, script = STEPS[step]
        success = run_step(step, name, script, base_args)
        if not success:
            print(f"\n流水线在 Step {step} 中断。修复问题后可加 --start-from {step} 从当前步骤继续。")
            sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  全部完成!")
    print(f"{'='*60}")
    print(f"  输出目录:")
    print(f"    data/raw/        — 原始采集数据")
    print(f"    data/clean/      — 清洗后数据")
    print(f"    data/selected/   — 精选后数据")
    print(f"    data/enriched/   — LLM增强后数据")
    print(f"    data/validated/  — 校验通过数据")
    print(f"    data/rejected/   — 校验拒绝数据 + 报告")
    print(f"    sql/             — 最终 SQL 文件")
    print()


if __name__ == "__main__":
    main()
