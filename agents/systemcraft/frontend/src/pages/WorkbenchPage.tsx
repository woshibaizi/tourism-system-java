import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ChevronsLeft,
  ChevronsRight,
  Expand,
  Gauge,
  GripVertical,
  LoaderCircle,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useShellStatus } from '../app/shell-status';
import { useUserSession } from '../app/user-session';
import { AgentFlow } from '../components/workbench/AgentFlow';
import { ArtifactView } from '../components/workbench/ArtifactView';
import { ChatStream } from '../components/workbench/ChatStream';
import { TraceabilityMatrix } from '../components/workbench/TraceabilityMatrix';
import {
  ApiError,
  getProject,
  iterateProject,
  makeProjectSocketUrl,
  pauseProject,
  resumeProject,
} from '../lib/api';
import {
  getProgressPercent,
  getStageArtifactKey,
  getStageMeta,
  getStatusLabel,
  isProjectActive,
} from '../lib/stage';
import type { AgentMessage, ArtifactKey, ProjectDetail } from '../types/api';

interface LocationState {
  project?: ProjectDetail;
}

type PanelKey = 'flow' | 'chat' | 'artifact';

const panelOrder: PanelKey[] = ['flow', 'chat', 'artifact'];
const panelMeta: Record<PanelKey, { title: string; subtitle: string }> = {
  flow: {
    title: 'AI 工作流程图',
    subtitle: '跟随阶段高亮，可直接跳转到对应产物。',
  },
  chat: {
    title: '协作对话流',
    subtitle: '实时查看分析、输出与交接记录。',
  },
  artifact: {
    title: '产出物预览',
    subtitle: '集中阅读需求、架构、代码与测试结果。',
  },
};

export function WorkbenchPage() {
  const { projectId = '' } = useParams();
  const location = useLocation();
  const { setStatus } = useShellStatus();
  const { isLoading: isSessionLoading } = useUserSession();
  const navigationState = (location.state as LocationState | null)?.project ?? null;

  const [project, setProject] = useState<ProjectDetail | null>(navigationState);
  const [messages, setMessages] = useState<AgentMessage[]>(navigationState?.agent_messages ?? []);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactKey>(
    getStageArtifactKey(navigationState?.current_stage),
  );
  const [isLoading, setIsLoading] = useState(!navigationState);
  const [missingProject, setMissingProject] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState<'idle' | 'connected' | 'offline'>('idle');
  const [isChangingRunState, setIsChangingRunState] = useState(false);
  const [displayProgress, setDisplayProgress] = useState<number>(
    navigationState?.progress_percent ?? 0,
  );
  const [iterationRequest, setIterationRequest] = useState('');
  const [isSubmittingIteration, setIsSubmittingIteration] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState<Record<PanelKey, boolean>>({
    flow: false,
    chat: false,
    artifact: false,
  });
  const [focusedPanel, setFocusedPanel] = useState<PanelKey | null>(null);
  const [panelWeights, setPanelWeights] = useState<Record<PanelKey, number>>({
    flow: 27,
    chat: 39,
    artifact: 34,
  });
  const [isDesktopLayout, setIsDesktopLayout] = useState(
    () => window.matchMedia('(min-width: 1280px)').matches,
  );
  const panelRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const syncLayout = () => setIsDesktopLayout(mediaQuery.matches);

    syncLayout();
    mediaQuery.addEventListener('change', syncLayout);

    return () => {
      mediaQuery.removeEventListener('change', syncLayout);
    };
  }, []);

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    let isActive = true;

    async function hydrateProject() {
      setIsLoading(true);

      try {
        const nextProject = await getProject(projectId);
        if (!isActive) {
          return;
        }

        setMissingProject(false);
        setError('');
        setProject(nextProject);
        setMessages(nextProject.agent_messages ?? []);
      } catch (loadError) {
        if (!isActive || !(loadError instanceof Error)) {
          return;
        }

        if (loadError instanceof ApiError && loadError.status === 404) {
          setMissingProject(true);
          setProject(null);
          setMessages([]);
          setError('');
          return;
        }

        setMissingProject(false);
        setError(loadError.message);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    if (!navigationState || navigationState.id !== projectId) {
      void hydrateProject();
    }

    return () => {
      isActive = false;
    };
  }, [isSessionLoading, navigationState, projectId]);

  useEffect(() => {
    if (isSessionLoading || !projectId || missingProject || (!project && !navigationState)) {
      return;
    }

    const socket = new WebSocket(makeProjectSocketUrl(projectId));
    let pingTimer: number | undefined;

    socket.onopen = () => {
      setConnectionState('connected');
      pingTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as
        | (AgentMessage & { type?: string })
        | { type: 'project_state'; project: ProjectDetail };

      if (payload.type === 'pong') {
        return;
      }

      if (payload.type === 'project_state' && 'project' in payload) {
        setMissingProject(false);
        setProject(payload.project);
        setMessages(payload.project.agent_messages ?? []);
        return;
      }

      if (payload.type === 'agent_message') {
        appendMessage(payload as AgentMessage);
        return;
      }

      appendMessage(payload as AgentMessage);
    };

    function appendMessage(payload: AgentMessage) {
      setMessages((currentMessages) => {
        const alreadyExists = currentMessages.some(
          (message) =>
            message.agent_role === payload.agent_role &&
            message.stage === payload.stage &&
            message.msg_type === payload.msg_type &&
            message.content === payload.content,
        );

        return alreadyExists ? currentMessages : [...currentMessages, payload];
      });
    }

    socket.onerror = () => {
      setConnectionState('offline');
    };

    socket.onclose = () => {
      setConnectionState('offline');
      if (pingTimer) {
        window.clearInterval(pingTimer);
      }
    };

    return () => {
      if (pingTimer) {
        window.clearInterval(pingTimer);
      }
      socket.close();
    };
  }, [isSessionLoading, missingProject, navigationState?.id, projectId, Boolean(project)]);

  useEffect(() => {
    if (
      isSessionLoading ||
      !projectId ||
      !project ||
      !['queued', 'running', 'pausing'].includes(project.status)
    ) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const nextProject = await getProject(projectId);
        setMissingProject(false);
        setError('');
        setProject(nextProject);
        setMessages(nextProject.agent_messages ?? []);
      } catch (pollError) {
        if (!(pollError instanceof Error)) {
          return;
        }

        if (pollError instanceof ApiError && pollError.status === 404) {
          setMissingProject(true);
          setProject(null);
          setMessages([]);
          setError('');
          return;
        }

        setError(pollError.message);
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [isSessionLoading, projectId, project?.status]);

  useEffect(() => {
    if (project?.current_stage) {
      setActiveArtifact(getStageArtifactKey(project.current_stage));
    }
  }, [project?.current_stage]);

  useEffect(() => {
    if (project?.status === 'queued' || project?.status === 'running') {
      setIterationRequest('');
    }
  }, [project?.status, project?.iteration_history?.length]);

  useEffect(() => () => setStatus(null), [setStatus]);

  useEffect(() => {
    if (missingProject) {
      setStatus({
        tone: 'error',
        label: '项目不存在',
        detail:
          '这个工作台链接对应的项目在当前后端实例中不存在，通常是因为开发模式下后端重启后内存数据被重载。',
      });
      return;
    }

    if (!project && !error) {
      setStatus({
        tone: 'idle',
        label: '工作台同步中',
        detail: '正在连接项目状态与实时消息流，请稍候。',
      });
      return;
    }

    if (project) {
      const stageLabel =
        project.status === 'completed' ? '全部完成' : getStageMeta(project.current_stage).label;
      const tone =
        project.status === 'paused'
          ? 'paused'
          : project.status === 'completed'
            ? 'success'
            : project.status === 'error'
              ? 'error'
              : 'active';

      setStatus({
        tone,
        label: `${getStatusLabel(project.status)} · ${stageLabel}`,
        detail: project.progress_message || project.status_detail || project.description,
        progress: project.progress_percent ?? getProgressPercent(project),
        href: `/workbench/${project.id}`,
      });
      return;
    }

    setStatus({
      tone: 'error',
      label: '工作台加载异常',
      detail: error || '项目状态同步失败，请刷新或重新进入工作台。',
    });
  }, [error, missingProject, project, setStatus]);

  const targetProgress = project?.progress_percent ?? getProgressPercent(project);

  useEffect(() => {
    if (!project) {
      return;
    }

    if (!['queued', 'running', 'pausing'].includes(project.status)) {
      setDisplayProgress(targetProgress);
      return;
    }

    setDisplayProgress((current) => (targetProgress > current ? targetProgress : current));
  }, [project, targetProgress]);

  useEffect(() => {
    if (!project || !['queued', 'running', 'pausing'].includes(project.status)) {
      return;
    }

    const optimisticCap = Math.min(99, targetProgress + (project.status === 'pausing' ? 2 : 8));

    const intervalId = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (targetProgress > current) {
          return Math.min(targetProgress, current + 1.8);
        }

        if (current < optimisticCap) {
          return Math.min(optimisticCap, current + 0.35);
        }

        return current;
      });
    }, 900);

    return () => window.clearInterval(intervalId);
  }, [
    project?.current_stage,
    project?.progress_message,
    project?.status,
    project?.status_detail,
    project,
    targetProgress,
  ]);

  useEffect(() => {
    if (!focusedPanel) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [focusedPanel]);

  useEffect(() => {
    if (!focusedPanel) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFocusedPanel(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedPanel]);

  if (isLoading || isSessionLoading) {
    return (
      <div className="glass-panel flex min-h-[480px] items-center justify-center rounded-[32px] p-8 text-sm text-slate-500 dark:text-slate-400">
        正在加载项目工作台...
      </div>
    );
  }

  if (missingProject) {
    return (
      <div className="glass-panel rounded-[32px] p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-700 dark:text-rose-300">
          <WifiOff className="h-3.5 w-3.5" />
          项目不存在
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          这个工作台项目在当前后端里不存在
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          最常见的原因是开发模式下后端热重启后，内存中的项目被重新加载。现在新版后端会尽量把项目保存到本地；如果这个链接仍然失效，可以返回首页重新进入项目列表或重新创建一次。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] dark:bg-white dark:text-slate-950"
          >
            返回首页
          </Link>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            项目 ID：{projectId}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-sm text-rose-700 dark:text-rose-200">
        {error}
      </div>
    );
  }

  const currentStage = project?.current_stage;
  const currentStageMeta =
    currentStage === 'completed'
      ? {
          label: '全部阶段完成',
          summary: '全部 Agent 已执行完毕，产物已经可以查看。',
        }
      : getStageMeta(currentStage);
  const canPause = ['queued', 'running'].includes(project?.status ?? '');
  const canResume = project?.status === 'paused';
  const canIterate = project?.status === 'completed';
  const activityTitle = project?.status === 'paused' ? '生成已暂停' : '生成进行中';
  const progressValue = Math.round(displayProgress);
  const progressLabel =
    project?.progress_message ||
    project?.status_detail ||
    '系统正在组织多 Agent 协作，请稍候。';

  function togglePanel(panel: PanelKey) {
    setCollapsedPanels((current) => ({
      ...current,
      [panel]: !current[panel],
    }));
  }

  function getExpandedKeys() {
    return panelOrder.filter((panel) => !collapsedPanels[panel]);
  }

  function getExpandedWeightTotal(keys = getExpandedKeys()) {
    return keys.reduce((sum, key) => sum + panelWeights[key], 0);
  }

  function getPanelStyle(panel: PanelKey): CSSProperties | undefined {
    if (!isDesktopLayout || collapsedPanels[panel]) {
      return undefined;
    }

    return {
      flexGrow: panelWeights[panel],
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
    };
  }

  function startResize(
    left: PanelKey,
    right: PanelKey,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!isDesktopLayout || collapsedPanels[left] || collapsedPanels[right]) {
      return;
    }

    const containerWidth = panelRowRef.current?.clientWidth ?? 0;
    if (!containerWidth) {
      return;
    }

    event.preventDefault();

    const totalWeight = getExpandedWeightTotal();
    const pairWeight = panelWeights[left] + panelWeights[right];
    const minimumWeight = Math.max(totalWeight * 0.2, 12);
    const startX = event.clientX;
    const initialLeft = panelWeights[left];
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaPercent = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const deltaWeight = (deltaPercent / 100) * totalWeight;
      const boundedLeft = Math.min(
        Math.max(initialLeft + deltaWeight, minimumWeight),
        pairWeight - minimumWeight,
      );

      setPanelWeights((current) => ({
        ...current,
        [left]: boundedLeft,
        [right]: pairWeight - boundedLeft,
      }));
    }

    function handlePointerUp() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  function renderPanelContent(panel: PanelKey, focusMode = false) {
    if (panel === 'flow') {
      return (
        <AgentFlow
          currentStage={project?.current_stage}
          iterationCount={project?.iteration_count ?? 0}
          status={project?.status ?? 'running'}
          onSelectStage={(stageId) => setActiveArtifact(getStageArtifactKey(stageId))}
        />
      );
    }

    if (panel === 'chat') {
      return <ChatStream messages={messages} connectionState={connectionState} />;
    }

    return (
      <ArtifactView
        activeArtifact={activeArtifact}
        onChangeArtifact={setActiveArtifact}
        project={project}
        focusMode={focusMode}
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="glass-panel-strong rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Activity className="h-3.5 w-3.5" />
              工作台
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[2.4rem]">
              {project?.project_name || project?.description}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              {project?.status_detail || project?.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <span className="status-pill bg-blue-500/10 text-blue-700 dark:text-blue-300">
                当前阶段：{currentStageMeta.label}
              </span>
              <span className="status-pill bg-slate-900/5 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {getStatusLabel(project?.status)}
              </span>
              <span className="status-pill bg-slate-900/5 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {connectionState === 'connected' ? '实时连接正常' : '实时连接离线'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <WorkbenchStat
              icon={Gauge}
              label="进度"
              value={`${progressValue}%`}
            />
            <WorkbenchStat
              icon={connectionState === 'connected' ? Wifi : WifiOff}
              label="连接"
              value={connectionState === 'connected' ? '在线' : '离线'}
            />
            <WorkbenchStat
              icon={RefreshCcw}
              label="迭代"
              value={`${project?.iteration_count ?? 0} 轮`}
            />

            {canPause ? (
              <button
                type="button"
                disabled={isChangingRunState || project?.status === 'pausing'}
                onClick={async () => {
                  if (!projectId) {
                    return;
                  }

                  setIsChangingRunState(true);
                  setError('');
                  try {
                    const nextProject = await pauseProject(projectId);
                    setProject(nextProject);
                    setMessages(nextProject.agent_messages ?? []);
                  } catch (pauseError) {
                    if (pauseError instanceof Error) {
                      setError(pauseError.message);
                    }
                  } finally {
                    setIsChangingRunState(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-700 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300"
              >
                {isChangingRunState || project?.status === 'pausing' ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <PauseCircle className="h-4 w-4" />
                )}
                {project?.status === 'pausing' ? '暂停请求中...' : '暂停生成'}
              </button>
            ) : null}

            {canResume ? (
              <button
                type="button"
                disabled={isChangingRunState}
                onClick={async () => {
                  if (!projectId) {
                    return;
                  }

                  setIsChangingRunState(true);
                  setError('');
                  try {
                    const nextProject = await resumeProject(projectId);
                    setProject(nextProject);
                    setMessages(nextProject.agent_messages ?? []);
                  } catch (resumeError) {
                    if (resumeError instanceof Error) {
                      setError(resumeError.message);
                    }
                  } finally {
                    setIsChangingRunState(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {isChangingRunState ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                继续生成
              </button>
            ) : null}

            {project?.status === 'completed' ? (
              <Link
                to={`/showcase/${project.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
              >
                <Sparkles className="h-4 w-4" />
                成果展示页
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-white/72 px-4 py-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">
            <span>{activityTitle}</span>
            <span>{currentStageMeta.summary}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-600 dark:text-slate-300">
            <span>{progressLabel}</span>
            <span className="shrink-0 text-base font-semibold text-slate-950 dark:text-white">
              {progressValue}%
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          </div>
        </div>
      </section>

      <TraceabilityMatrix project={project} onOpenArtifact={setActiveArtifact} />

      {canIterate ? (
        <section className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                <RefreshCcw className="h-3.5 w-3.5" />
                二次迭代
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                发起下一轮变更
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
                输入新的功能或修改要求，系统会基于当前项目继续迭代。
              </p>
            </div>

            <Link
              to={`/showcase/${project?.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
            >
              <Sparkles className="h-4 w-4" />
              打开成果展示页
            </Link>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <textarea
                value={iterationRequest}
                onChange={(event) => setIterationRequest(event.target.value)}
                placeholder="例如：增加管理员数据分析看板，优化移动端接口结构，并补强文件上传相关的测试方案。"
                className="min-h-[160px] w-full rounded-[26px] border border-slate-200 bg-white/80 px-5 py-4 text-sm leading-7 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-white/20"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isSubmittingIteration || !iterationRequest.trim()}
                  onClick={async () => {
                    if (!projectId || !iterationRequest.trim()) {
                      return;
                    }

                    setIsSubmittingIteration(true);
                    setError('');
                    try {
                      const nextProject = await iterateProject(projectId, {
                        change_request: iterationRequest.trim(),
                      });
                      setProject(nextProject);
                      setMessages(nextProject.agent_messages ?? []);
                      setIterationRequest('');
                    } catch (iterationError) {
                      if (iterationError instanceof Error) {
                        setError(iterationError.message);
                      }
                    } finally {
                      setIsSubmittingIteration(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
                >
                  {isSubmittingIteration ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  开始新一轮迭代
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[24px] border border-white/10 bg-white/70 px-5 py-4 dark:bg-white/5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  迭代记录
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
                  {project?.iteration_history?.length ?? 0}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  每一轮变更需求都会保留下来，方便你回看项目是如何一步步演进的。
                </p>
              </div>

              {(project?.iteration_history?.length ?? 0) > 0 ? (
                <div className="space-y-3">
                  {(project?.iteration_history ?? []).slice(-3).reverse().map((entry, index) => (
                    <article
                      key={entry.id}
                      className="rounded-[24px] border border-white/10 bg-white/70 px-4 py-4 dark:bg-white/5"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        第 {(project?.iteration_history?.length ?? 0) - index} 轮 ·{' '}
                        {new Date(entry.created_at).toLocaleString()}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {entry.change_request}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300/80 px-5 py-6 text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
                  你的第一条交付后变更需求会显示在这里。
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section
        ref={panelRowRef}
        className="flex min-w-0 w-full max-w-full flex-col gap-4 overflow-hidden xl:h-[calc(100vh-7.25rem)] xl:min-h-[840px] xl:flex-row xl:items-stretch xl:gap-3"
      >
        <PanelShell
          title="AI 工作流程图"
          subtitle="流程节点会跟随阶段变化。"
          collapsed={collapsedPanels.flow}
          onToggle={() => togglePanel('flow')}
          onFocus={() => setFocusedPanel('flow')}
          className={collapsedPanels.flow ? 'xl:w-[84px] xl:flex-none' : 'xl:min-w-0'}
          style={getPanelStyle('flow')}
        >
          {renderPanelContent('flow')}
        </PanelShell>

        <ResizeHandle
          visible={!collapsedPanels.flow && !collapsedPanels.chat}
          onPointerDown={(event) => startResize('flow', 'chat', event)}
        />

        <PanelShell
          title="协作对话流"
          subtitle="完整查看分析、输出与交接。"
          collapsed={collapsedPanels.chat}
          onToggle={() => togglePanel('chat')}
          onFocus={() => setFocusedPanel('chat')}
          className={collapsedPanels.chat ? 'xl:w-[84px] xl:flex-none' : 'xl:min-w-0'}
          style={getPanelStyle('chat')}
        >
          {renderPanelContent('chat')}
        </PanelShell>

        <ResizeHandle
          visible={!collapsedPanels.chat && !collapsedPanels.artifact}
          onPointerDown={(event) => startResize('chat', 'artifact', event)}
        />

        <PanelShell
          title="产出物预览"
          subtitle="集中查看需求、架构、代码与测试。"
          collapsed={collapsedPanels.artifact}
          onToggle={() => togglePanel('artifact')}
          onFocus={() => setFocusedPanel('artifact')}
          className={collapsedPanels.artifact ? 'xl:w-[84px] xl:flex-none' : 'xl:min-w-0'}
          style={getPanelStyle('artifact')}
        >
          {renderPanelContent('artifact')}
        </PanelShell>
      </section>

      <AnimatePresence>
        {focusedPanel ? (
          <motion.div
            className="fixed inset-0 z-[80] bg-slate-950/55 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFocusedPanel(null)}
          >
            <motion.section
              className="glass-panel-strong mx-auto flex h-full w-full max-w-[1560px] flex-col overflow-hidden rounded-[36px] p-5 sm:p-6"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div className="max-w-3xl">
                  <div className="section-title">{panelMeta[focusedPanel].title}</div>
                  <p className="section-subtitle mt-2">{panelMeta[focusedPanel].subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setFocusedPanel(null)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/75 text-slate-600 transition hover:text-slate-950 dark:bg-white/8 dark:text-slate-300 dark:hover:text-white"
                  aria-label={`关闭${panelMeta[focusedPanel].title}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 min-h-0 flex-1">{renderPanelContent(focusedPanel, true)}</div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

interface WorkbenchStatProps {
  label: string;
  value: string;
  icon: typeof Activity;
}

function WorkbenchStat({ label, value, icon: Icon }: WorkbenchStatProps) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2.5 text-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="text-sm font-semibold text-slate-950 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

interface PanelShellProps {
  title: string;
  subtitle: string;
  collapsed: boolean;
  onToggle: () => void;
  onFocus?: () => void;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}

function PanelShell({
  title,
  subtitle,
  collapsed,
  onToggle,
  onFocus,
  className,
  style,
  children,
}: PanelShellProps) {
  return (
    <section className={`min-h-0 min-w-0 max-w-full ${className}`} style={style}>
      <div className="glass-panel relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-[30px] p-4">
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          {onFocus ? (
            <button
              type="button"
              onClick={onFocus}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/75 text-slate-600 transition hover:text-slate-950 dark:bg-white/8 dark:text-slate-300 dark:hover:text-white"
              aria-label={`聚焦查看${title}`}
            >
              <Expand className="h-4 w-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/75 text-slate-600 transition hover:text-slate-950 dark:bg-white/8 dark:text-slate-300 dark:hover:text-white"
            aria-label={collapsed ? `展开${title}` : `收起${title}`}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        {collapsed ? (
          <div className="flex h-full items-center justify-center">
            <div className="[writing-mode:vertical-rl] rotate-180 text-center">
              <div className="text-sm font-semibold text-slate-950 dark:text-white">{title}</div>
              <div className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                点击展开
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 pr-24">
              <div className="text-base font-semibold text-slate-950 dark:text-white">{title}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
          </>
        )}
      </div>
    </section>
  );
}

interface ResizeHandleProps {
  visible: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

function ResizeHandle({ visible, onPointerDown }: ResizeHandleProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="relative hidden xl:flex xl:w-0 xl:flex-none xl:items-stretch xl:justify-center xl:overflow-visible">
      <button
        type="button"
        onPointerDown={onPointerDown}
        aria-label="拖动调整面板宽度"
        className="group absolute left-1/2 top-0 flex h-full w-4 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center rounded-full"
      >
        <div className="flex h-full min-h-[360px] w-1.5 items-center justify-center rounded-full bg-slate-200/80 transition group-hover:bg-slate-300 dark:bg-white/10 dark:group-hover:bg-white/20">
          <GripVertical className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        </div>
      </button>
    </div>
  );
}
