import type { Difficulty } from '../types/api';

export interface ProjectTemplateDefinition {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  summary: string;
  prompt: string;
  highlights: string[];
}

export const projectTemplates: ProjectTemplateDefinition[] = [
  {
    id: 'campus-market',
    title: '校园二手交易平台',
    category: '交易平台',
    difficulty: 'medium',
    summary: '面向学生的二手交易系统，支持商品发布、私聊沟通、收藏和订单跟踪。',
    prompt:
      '做一个校园二手交易平台，支持商品发布、关键词搜索、收藏、买卖双方即时聊天、订单跟踪，以及管理员审核与违规内容处理后台。',
    highlights: ['交易流程', '即时聊天', '审核后台'],
  },
  {
    id: 'online-exam',
    title: '在线考试系统',
    category: '教育场景',
    difficulty: 'medium',
    summary: '支持题库管理、组卷、在线考试、自动阅卷和成绩分析的完整考试平台。',
    prompt:
      '做一个在线考试管理系统，支持题库管理、组卷、限时考试、自动阅卷、成绩分析，并区分教师、学生和管理员三类角色权限。',
    highlights: ['题库管理', '自动阅卷', '成绩分析'],
  },
  {
    id: 'library-ops',
    title: '图书馆管理系统',
    category: '管理系统',
    difficulty: 'easy',
    summary: '紧凑型图书管理系统，涵盖入库、借阅、归还、超期提醒和库存预警。',
    prompt:
      '做一个图书馆管理系统，支持图书编目、读者注册、借阅与归还流程、逾期提醒、库存预警和管理员统计报表。',
    highlights: ['借阅流程', '库存预警', '统计报表'],
  },
  {
    id: 'project-collab',
    title: '团队协作平台',
    category: '协作产品',
    difficulty: 'hard',
    summary: '项目协作工作台，支持任务看板、里程碑、讨论区和交付进度总览。',
    prompt:
      '做一个团队协作平台，支持项目空间、任务看板、里程碑规划、线程式讨论、附件上传、通知提醒和管理者交付仪表盘。',
    highlights: ['项目空间', '任务看板', '交付仪表盘'],
  },
  {
    id: 'clinic-booking',
    title: '门诊预约系统',
    category: '服务系统',
    difficulty: 'hard',
    summary: '面向门诊场景的预约与接诊平台，覆盖排班、预约、分诊和就诊记录。',
    prompt:
      '做一个门诊预约与患者服务系统，支持医生排班、患者预约、分诊记录、叫号队列、就诊历史和运营数据看板。',
    highlights: ['医生排班', '排队叫号', '就诊记录'],
  },
  {
    id: 'study-companion',
    title: '学习陪伴应用',
    category: '学习工具',
    difficulty: 'easy',
    summary: '轻量学习工具，支持学习计划、记忆卡片、复习提醒和学习周报。',
    prompt:
      '做一个学习陪伴应用，支持学习计划、间隔重复记忆卡片、复习提醒、每周学习报告，以及教师或导师查看学习概况的功能。',
    highlights: ['学习计划', '记忆卡片', '学习周报'],
  },
];
