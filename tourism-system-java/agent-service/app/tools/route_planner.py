from __future__ import annotations


def build_route_outline(requirement: str) -> dict:
    """
    生成路线规划占位结果。

    当前阶段的目标是先稳定前后端数据契约，因此这里返回固定结构，
    后续再把内部实现替换成真实的景点推荐 + 路线计算。
    """
    return {
        "summary": "已生成一个可继续细化的轻量路线草案",
        "highlights": [
            "优先考虑顺路与停留节奏",
            "保留拍照和休息时间",
            "后续可继续接入真实导航工具补全距离与耗时",
        ],
        "estimated_minutes": 180 if "半天" in requirement else 360,
    }
