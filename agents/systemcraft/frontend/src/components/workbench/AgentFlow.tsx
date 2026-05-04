import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from 'reactflow';
import { useEffect, useMemo, useRef, useState } from 'react';
import { stageDefinitions } from '../../lib/stage';

interface AgentFlowProps {
  currentStage?: string;
  iterationCount: number;
  status: string;
  onSelectStage: (stageId: string) => void;
}

interface StageNodeData {
  label: string;
  summary: string;
  color: string;
  status: 'active' | 'completed' | 'pending';
}

function StageNode({ data }: NodeProps<StageNodeData>) {
  const statusLabel =
    data.status === 'active'
      ? '当前执行'
      : data.status === 'completed'
        ? '已完成'
        : '待执行';

  return (
    <div
      className={`min-w-[196px] rounded-[24px] border px-4 py-4 shadow-sm transition-all ${
        data.status === 'active' ? 'animate-pulseSoft' : ''
      }`}
      style={{
        borderColor: data.status === 'active' ? data.color : 'rgba(148, 163, 184, 0.18)',
        background:
          data.status === 'active'
            ? `${data.color}18`
            : data.status === 'completed'
              ? 'rgba(34, 197, 94, 0.12)'
              : 'rgba(255, 255, 255, 0.76)',
        boxShadow: data.status === 'active' ? `0 0 0 6px ${data.color}18` : 'none',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-0 !bg-slate-300"
      />
      <div className="text-sm font-semibold text-slate-950">{data.label}</div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {statusLabel}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">{data.summary}</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-0 !bg-slate-300"
      />
    </div>
  );
}

const nodeTypes = {
  stage: StageNode,
};

export function AgentFlow({
  currentStage,
  iterationCount,
  status,
  onSelectStage,
}: AgentFlowProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<StageNodeData, Edge> | null>(
    null,
  );
  const currentIndex = stageDefinitions.findIndex((stage) => stage.id === currentStage);

  const nodes = useMemo<Node<StageNodeData>[]>(() => {
    return stageDefinitions.map((stage, index) => {
      const nodeStatus: StageNodeData['status'] =
        status === 'completed'
          ? index === stageDefinitions.length - 1
            ? 'active'
            : 'completed'
          : currentStage === stage.id
            ? 'active'
            : currentIndex >= 0 && index < currentIndex
              ? 'completed'
              : 'pending';

      return {
        id: stage.id,
        type: 'stage',
        position: { x: index * 244, y: 48 },
        data: {
          label: stage.label,
          summary: stage.summary,
          color: stage.color,
          status: nodeStatus,
        },
      };
    });
  }, [currentIndex, currentStage, status]);

  const edges = useMemo<Edge[]>(() => {
    const nextEdges: Edge[] = stageDefinitions.slice(0, -1).map((stage, index) => ({
      id: `${stage.id}-${stageDefinitions[index + 1].id}`,
      source: stage.id,
      target: stageDefinitions[index + 1].id,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke:
          currentIndex >= index
            ? stageDefinitions[index + 1].color
            : 'rgba(148, 163, 184, 0.35)',
        strokeWidth: 2.5,
      },
    }));

    nextEdges.push({
      id: 'qa-loop',
      source: 'testing',
      target: 'development',
      type: 'smoothstep',
      label: iterationCount > 0 ? `返工 ${iterationCount} 次` : '发现问题 -> 返工',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke: iterationCount > 0 ? '#f97316' : 'rgba(249, 115, 22, 0.35)',
        strokeDasharray: '6 6',
        strokeWidth: 2,
      },
    });

    return nextEdges;
  }, [currentIndex, iterationCount]);

  useEffect(() => {
    if (!flowInstance) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      flowInstance.fitView({
        padding: 0.18,
        duration: 240,
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [flowInstance, currentStage, iterationCount, nodes, status]);

  useEffect(() => {
    if (!flowInstance || !canvasRef.current) {
      return;
    }

    const observer = new ResizeObserver(() => {
      flowInstance.fitView({
        padding: 0.18,
        duration: 160,
      });
    });

    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [flowInstance]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div
        ref={canvasRef}
        className="h-[248px] shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-white/70 dark:bg-slate-950/40"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          minZoom={0.58}
          maxZoom={1.2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          onInit={setFlowInstance}
          onNodeClick={(_, node) => onSelectStage(node.id)}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} color="rgba(148, 163, 184, 0.18)" />
          <Controls showInteractive={false} position="top-right" />
        </ReactFlow>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-3">
          {stageDefinitions.map((stage, index) => {
            const isCurrent = currentStage === stage.id;
            const isDone = status === 'completed' || (currentIndex >= 0 && index < currentIndex);

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectStage(stage.id)}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  isCurrent
                    ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                    : 'border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{stage.label}</div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                      isCurrent
                        ? 'bg-white/12 text-white dark:bg-slate-900/10 dark:text-slate-700'
                        : isDone
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                          : 'bg-slate-900/5 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                    }`}
                  >
                    {isCurrent ? '进行中' : isDone ? '完成' : '待执行'}
                  </span>
                </div>
                <p
                  className={`mt-2 text-sm leading-6 ${
                    isCurrent ? 'text-white/78 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {stage.summary}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
