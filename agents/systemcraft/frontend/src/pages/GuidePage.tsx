import {
  BookOpenCheck,
  BriefcaseBusiness,
  Compass,
  GraduationCap,
  Network,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
  Code2,
} from 'lucide-react';

const workflowSteps = [
  {
    title: 'PM Agent',
    detail: '先拆解目标、使用角色和核心场景，明确这个项目到底要解决什么问题。',
  },
  {
    title: 'Arch Agent',
    detail: '根据需求抽出系统结构、模块边界、数据库和接口设计，搭起实现骨架。',
  },
  {
    title: 'Dev Agent',
    detail: '把方案落成代码与页面，给出更接近真实工程交付的核心实现。',
  },
  {
    title: 'QA Agent',
    detail: '检查缺陷、边界和风险，必要时推动返工，让流程像真实团队一样闭环。',
  },
  {
    title: 'Mentor Agent',
    detail: '最后沉淀总结、知识卡片和复盘建议，让结果真正可学习、可讲解。',
  },
] as const;

const agentProfiles = [
  {
    title: 'PM Agent',
    role: '产品经理型',
    icon: BriefcaseBusiness,
    description: '擅长把模糊想法拆成清晰需求，关注目标、范围、优先级和最终交付价值。',
  },
  {
    title: 'Arch Agent',
    role: '架构设计型',
    icon: Network,
    description: '负责整体结构和技术路线，让项目在实现前就有一套清晰可落地的方案。',
  },
  {
    title: 'Dev Agent',
    role: '工程实现型',
    icon: Code2,
    description: '强调落地效率与实现细节，把文档中的设计变成真实代码和页面结构。',
  },
  {
    title: 'QA Agent',
    role: '质量守门型',
    icon: ShieldCheck,
    description: '对 bug、异常路径和体验风险更敏感，专门负责检查和收口。',
  },
  {
    title: 'Mentor Agent',
    role: '教学辅导型',
    icon: GraduationCap,
    description: '把过程解释清楚，提炼知识点和复盘建议，帮助你真正理解整个工程链路。',
  },
] as const;

export function GuidePage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: '协作角色', value: '5', icon: Sparkles },
          { label: '主流程阶段', value: '5', icon: Workflow },
          { label: '适用场景', value: '教学 / 演示 / 复盘', icon: Compass },
        ].map(({ label, value, icon: Icon }) => (
          <article key={label} className="glass-panel rounded-[28px] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {value}
            </div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{label}</div>
          </article>
        ))}
      </section>

      <section className="glass-panel rounded-[32px] p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white dark:bg-white dark:text-slate-950">
          <BookOpenCheck className="h-3.5 w-3.5" />
          项目介绍
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          SystemCraft 是一个把软件工程全过程“展开给你看”的 AI 工作台
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          它不只给出最后答案，而是把需求分析、架构设计、开发实现、测试评审和复盘教学串成一条完整协作链路。
          你既能看到最终产物，也能看到过程是如何被讨论、分工和推进的。
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: '适用场景',
              description: '课程作业、毕业设计原型、课堂演示、软件工程流程讲解和项目复盘。',
              icon: Compass,
            },
            {
              title: '核心价值',
              description: '同时呈现结果、过程、思路和阶段产物，而不是只给你一份答案。',
              icon: Sparkles,
            },
            {
              title: '最终收获',
              description: '理解从需求到交付的完整路径，并把知识沉淀成可复习的卡片与总结。',
              icon: Rocket,
            },
          ].map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="rounded-[24px] border border-white/10 bg-white/65 p-5 dark:bg-white/5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <article className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
            <Workflow className="h-3.5 w-3.5" />
            工作流程
          </div>
          <div className="mt-6 space-y-4">
            {workflowSteps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-[24px] border border-white/10 bg-white/65 px-5 py-4 dark:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
                    {index + 1}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {step.detail}
                </p>
              </article>
            ))}
          </div>
        </article>

        <article className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Agent 人格
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {agentProfiles.map(({ title, role, description, icon: Icon }) => (
              <article
                key={title}
                className="rounded-[24px] border border-white/10 bg-white/65 px-5 py-4 dark:bg-white/5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {role}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
