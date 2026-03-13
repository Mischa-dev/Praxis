import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  type Node,
  type Edge,
  type OnConnect,
  type Connection,
  type IsValidConnection,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Save,
  FolderOpen,
  Trash2,
  ArrowLeft,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button, Badge } from '../common'
import { ToolNode } from './PipelineNode'
import { StartNode } from './StartNode'
import { ConditionNode } from './ConditionNode'
import { ForEachNode } from './ForEachNode'
import { DelayNode } from './DelayNode'
import { NoteNode } from './NoteNode'
import { ShellNode } from './ShellNode'
import { PromptNode } from './PromptNode'
import { SetVariableNode } from './SetVariableNode'
import { ToolPalette } from './ToolPalette'
import { SaveDialog } from './SaveDialog'
import { LoadDialog } from './LoadDialog'
import { EdgeConfigDialog } from './EdgeConfigDialog'
import { PromptDialog } from './PromptDialog'
import {
  ToolConfigDialog,
  ConditionConfigDialog,
  ForEachConfigDialog,
  DelayConfigDialog,
  StartConfigDialog,
  NoteConfigDialog,
  ShellConfigDialog,
  PromptConfigDialog,
  SetVariableConfigDialog,
} from './NodeConfigDialog'
import type {
  ToolNodeData,
  ConditionNodeData,
  ForEachNodeData,
  DelayNodeData,
  NoteNodeData,
  StartNodeData,
  ShellNodeData,
  PromptNodeData,
  SetVariableNodeData,
  AnyNodeData,
} from './types'
import { useModuleStore } from '../../stores/module-store'
import { usePipelineStore } from '../../stores/pipeline-store'
import { useUiStore } from '../../stores/ui-store'
import type { Module } from '@shared/types'
import type { PipelinePromptEvent } from '@shared/types/ipc'
import type {
  PipelineDefinition,
  PipelineNodeV2,
  PipelineNodeV1,
  Pipeline,
  PipelineNodeType as NodeType,
  PipelineRun,
  DataMappingEntry,
  StepFailureAction,
  ShellNodeConfig,
  PromptNodeConfig,
  SetVariableNodeConfig,
} from '@shared/types/pipeline'

// ---------------------------------------------------------------------------
// Node type registry
// ---------------------------------------------------------------------------

const nodeTypes = {
  tool: ToolNode,
  start: StartNode,
  condition: ConditionNode,
  'for-each': ForEachNode,
  delay: DelayNode,
  note: NoteNode,
  shell: ShellNode,
  prompt: PromptNode,
  'set-variable': SetVariableNode,
}

let nodeIdCounter = 0
function nextNodeId(): string {
  return `node_${Date.now()}_${++nodeIdCounter}`
}

// ---------------------------------------------------------------------------
// Execution progress panel
// ---------------------------------------------------------------------------

function ExecutionPanel({
  run,
  onStop,
  expanded,
  onToggle,
}: {
  run: PipelineRun
  onStop: () => void
  expanded: boolean
  onToggle: () => void
}) {
  const completedCount = run.nodes.filter(
    (n) => n.status === 'completed' || n.status === 'failed' || n.status === 'skipped'
  ).length
  const totalCount = run.nodes.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const elapsed = Math.round(
    (Date.now() - new Date(run.startedAt).getTime()) / 1000
  )

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-bg-surface border-t border-border">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2">
        <button onClick={onToggle} className="text-text-muted hover:text-text-primary">
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary">
              {run.status === 'running' ? 'Running' : run.status === 'completed' ? 'Completed' : run.status === 'failed' ? 'Failed' : 'Cancelled'}
            </span>
            <span className="text-[10px] text-text-muted">
              {completedCount}/{totalCount} nodes
            </span>
            <span className="text-[10px] text-text-muted">{elapsed}s</span>
          </div>
          <div className="w-full h-1 bg-bg-base rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                run.status === 'failed' ? 'bg-red-500' : run.status === 'completed' ? 'bg-green-500' : 'bg-accent-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {run.status === 'running' && (
          <Button variant="secondary" size="sm" onClick={onStop}>
            <Square size={12} className="mr-1 text-red-400" />
            Stop
          </Button>
        )}
      </div>

      {/* Expanded node list */}
      {expanded && (
        <div className="px-4 pb-3 max-h-[200px] overflow-y-auto space-y-1">
          {run.nodes.map((nr) => (
            <div key={nr.nodeId} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${
                nr.status === 'pending' ? 'bg-text-muted' :
                nr.status === 'running' ? 'bg-accent-primary animate-pulse' :
                nr.status === 'completed' ? 'bg-green-400' :
                nr.status === 'failed' ? 'bg-red-400' :
                'bg-text-muted opacity-40'
              }`} />
              <span className="text-text-secondary font-mono flex-1 truncate">{nr.nodeId}</span>
              <Badge variant={
                nr.status === 'completed' ? 'success' :
                nr.status === 'failed' ? 'error' :
                nr.status === 'running' ? 'accent' :
                'default'
              }>
                {nr.status}
              </Badge>
              {nr.error && (
                <span className="text-[10px] text-red-400 truncate max-w-[200px]" title={nr.error}>
                  {nr.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main pipeline flow
// ---------------------------------------------------------------------------

function PipelineFlow({ pipelineId }: { pipelineId?: number }) {
  const modules = useModuleStore((s) => s.modules)
  const navigate = useUiStore((s) => s.navigate)
  const {
    savePipeline,
    updatePipeline,
    loadPipeline,
    activePipeline,
    removePipeline,
    setDirty,
    dirty,
    activeRun,
    executePipelineRun,
    cancelRun,
    clearRun,
  } = usePipelineStore()
  const { fitView } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [configNode, setConfigNode] = useState<Node | null>(null)
  const [configEdge, setConfigEdge] = useState<Edge | null>(null)
  const [showSave, setShowSave] = useState(false)
  const [showLoad, setShowLoad] = useState(false)
  const [execPanelExpanded, setExecPanelExpanded] = useState(false)
  const [activePrompt, setActivePrompt] = useState<PipelinePromptEvent | null>(null)
  const loaded = useRef(false)

  const isRunning = activeRun?.status === 'running'

  // Check if a start node exists
  const hasStartNode = useMemo(
    () => nodes.some((n) => n.type === 'start'),
    [nodes]
  )

  // ---------------------------------------------------------------------------
  // Load / restore pipeline
  // ---------------------------------------------------------------------------

  // Load pipeline from DB if a pipelineId prop is provided
  useEffect(() => {
    if (pipelineId && !loaded.current) {
      loaded.current = true
      loadPipeline(pipelineId)
    }
  }, [pipelineId, loadPipeline])

  // Restore nodes/edges whenever activePipeline changes (from DB load, external
  // set via workflow compilation, or load dialog)
  const lastPipelineRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activePipeline) return
    // Deduplicate: only restore if the definition actually changed
    const defKey = `${activePipeline.id}:${activePipeline.updated_at}`
    if (lastPipelineRef.current === defKey) return
    lastPipelineRef.current = defKey

    try {
      const def: PipelineDefinition = JSON.parse(activePipeline.definition)
      const restoredNodes = deserializeNodes(def, modules)
      const restoredEdges = deserializeEdges(def.edges)
      setNodes(restoredNodes)
      setEdges(restoredEdges)
      setTimeout(() => fitView({ padding: 0.2 }), 100)
    } catch {
      // Invalid definition
    }
  }, [activePipeline, modules, setNodes, setEdges, fitView])

  // ---------------------------------------------------------------------------
  // Apply execution status to node visuals
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!activeRun) return
    setNodes((nds) =>
      nds.map((n) => {
        const nodeRun = activeRun.nodes.find((nr) => nr.nodeId === n.id)
        if (!nodeRun) return n
        return {
          ...n,
          data: { ...n.data, status: nodeRun.status },
        }
      })
    )
  }, [activeRun, setNodes])

  // Clear node status when run is cleared
  useEffect(() => {
    if (!activeRun) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, status: undefined },
        }))
      )
    }
  }, [activeRun, setNodes])

  // Listen for pipeline prompt events
  useEffect(() => {
    const unsub = window.api.on('pipeline:prompt', (data: unknown) => {
      setActivePrompt(data as PipelinePromptEvent)
    })
    return () => unsub()
  }, [])

  // ---------------------------------------------------------------------------
  // Edge connection handling
  // ---------------------------------------------------------------------------

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (isRunning) return

      const sourceNode = nodes.find((n) => n.id === params.source)
      const isConditionSource = sourceNode?.type === 'condition'

      // Determine edge styling based on source handle
      let edgeStyle = { stroke: 'var(--accent-primary)' }
      let edgeLabel: string | undefined
      let markerColor = 'var(--accent-primary)'

      if (isConditionSource) {
        if (params.sourceHandle === 'true') {
          edgeStyle = { stroke: '#4ade80' } // green
          edgeLabel = 'TRUE'
          markerColor = '#4ade80'
        } else if (params.sourceHandle === 'false') {
          edgeStyle = { stroke: '#f87171' } // red
          edgeLabel = 'FALSE'
          markerColor = '#f87171'
        }
      }

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: edgeStyle,
            label: edgeLabel,
            labelStyle: { fill: edgeStyle.stroke, fontWeight: 600, fontSize: 10 },
            labelBgStyle: { fill: 'var(--bg-base)', fillOpacity: 0.8 },
            markerEnd: { type: MarkerType.ArrowClosed, color: markerColor },
            data: {
              sourceHandle: params.sourceHandle,
              dataMappings: [],
            },
          },
          eds,
        ),
      )
      setDirty(true)
    },
    [setEdges, setDirty, nodes, isRunning],
  )

  // ---------------------------------------------------------------------------
  // Edge validation
  // ---------------------------------------------------------------------------

  const isValidConnection: IsValidConnection = useCallback(
    (connection: Edge | Connection) => {
      // No self-loops
      if (connection.source === connection.target) return false

      const sourceNode = nodes.find((n) => n.id === connection.source)
      const targetNode = nodes.find((n) => n.id === connection.target)

      // NoteNode: no edges at all
      if (sourceNode?.type === 'note' || targetNode?.type === 'note') return false

      // StartNode: no incoming edges
      if (targetNode?.type === 'start') return false

      // ConditionNode: max one edge per handle
      if (sourceNode?.type === 'condition' && connection.sourceHandle) {
        const existingEdge = edges.find(
          (e) => e.source === connection.source && (e.data as { sourceHandle?: string })?.sourceHandle === connection.sourceHandle
        )
        if (existingEdge) return false
      }

      return true
    },
    [nodes, edges],
  )

  // ---------------------------------------------------------------------------
  // Add nodes
  // ---------------------------------------------------------------------------

  const handleAddToolNode = useCallback(
    (mod: Module, x: number, y: number) => {
      if (isRunning) return
      const id = nextNodeId()
      const newNode: Node = {
        id,
        type: 'tool',
        position: { x, y },
        data: {
          label: mod.name,
          toolId: mod.id,
          module: mod,
          args: {},
          configured: false,
        } satisfies ToolNodeData,
      }
      setNodes((nds) => [...nds, newNode])
      setDirty(true)
    },
    [setNodes, setDirty, isRunning],
  )

  const handleAddLogicNode = useCallback(
    (type: NodeType, x: number, y: number) => {
      if (isRunning) return
      if (type === 'start' && hasStartNode) return

      const id = nextNodeId()
      let data: AnyNodeData

      switch (type) {
        case 'start':
          data = { targetSource: 'selected', configured: true } satisfies StartNodeData
          break
        case 'condition':
          data = { expression: '', configured: false } satisfies ConditionNodeData
          break
        case 'for-each':
          data = { expression: '', itemVariable: 'item', parallel: false, configured: false } satisfies ForEachNodeData
          break
        case 'delay':
          data = { seconds: 5, configured: true } satisfies DelayNodeData
          break
        case 'note':
          data = { content: '', color: 'default', configured: true } satisfies NoteNodeData
          break
        case 'shell':
          data = { command: '', configured: false } satisfies ShellNodeData
          break
        case 'prompt':
          data = { message: '', promptType: 'text', variable: '', configured: false } satisfies PromptNodeData
          break
        case 'set-variable':
          data = { variable: '', value: '', configured: false } satisfies SetVariableNodeData
          break
        default:
          return
      }

      const newNode: Node = { id, type, position: { x, y }, data: data as unknown as Record<string, unknown> }
      setNodes((nds) => [...nds, newNode])
      setDirty(true)
    },
    [setNodes, setDirty, hasStartNode, isRunning],
  )

  // ---------------------------------------------------------------------------
  // Node double-click → config dialog
  // ---------------------------------------------------------------------------

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (isRunning) return
      setConfigNode(node)
    },
    [isRunning],
  )

  // ---------------------------------------------------------------------------
  // Edge double-click → data mapping dialog
  // ---------------------------------------------------------------------------

  const handleEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (isRunning) return
      // Only show mapping dialog for non-condition edges to tool nodes
      const targetNode = nodes.find((n) => n.id === edge.target)
      if (targetNode?.type === 'tool') {
        setConfigEdge(edge)
      }
    },
    [nodes, isRunning],
  )

  // ---------------------------------------------------------------------------
  // Config save handlers
  // ---------------------------------------------------------------------------

  const handleToolConfigSave = useCallback(
    (args: Record<string, unknown>) => {
      if (!configNode) return
      setNodes((nds) =>
        nds.map((n) =>
          n.id === configNode.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  args,
                  configured: Object.values(args).some((v) => v !== '' && v !== false && v != null),
                },
              }
            : n,
        ),
      )
      setConfigNode(null)
      setDirty(true)
    },
    [configNode, setNodes, setDirty],
  )

  const handleGenericConfigSave = useCallback(
    (updates: Partial<AnyNodeData>) => {
      if (!configNode) return
      setNodes((nds) =>
        nds.map((n) =>
          n.id === configNode.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  ...updates,
                  configured: true,
                },
              }
            : n,
        ),
      )
      setConfigNode(null)
      setDirty(true)
    },
    [configNode, setNodes, setDirty],
  )

  const handleEdgeMappingSave = useCallback(
    (mappings: DataMappingEntry[]) => {
      if (!configEdge) return
      setEdges((eds) =>
        eds.map((e) =>
          e.id === configEdge.id
            ? { ...e, data: { ...e.data, dataMappings: mappings } }
            : e,
        ),
      )
      setConfigEdge(null)
      setDirty(true)
    },
    [configEdge, setEdges, setDirty],
  )

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  const getDefinition = useCallback((): PipelineDefinition => {
    return {
      version: 2,
      nodes: nodes.map((n) => serializeNode(n)),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: (e.data as { sourceHandle?: string })?.sourceHandle as 'true' | 'false' | undefined,
        dataMappings: (e.data as { dataMappings?: DataMappingEntry[] })?.dataMappings,
        dataMapping: (e.data as { dataMapping?: Record<string, string> })?.dataMapping,
      })),
    }
  }, [nodes, edges])

  // ---------------------------------------------------------------------------
  // Save / load / clear
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(
    async (name: string, description: string) => {
      const def = getDefinition()
      if (activePipeline && activePipeline.id > 0) {
        // Update existing saved pipeline
        await updatePipeline(activePipeline.id, {
          name,
          description,
          definition: JSON.stringify(def),
        })
      } else {
        // New pipeline (or compiled workflow with id=-1) — save as new
        await savePipeline(name, description, def)
      }
      setShowSave(false)
    },
    [getDefinition, activePipeline, updatePipeline, savePipeline],
  )

  const handleLoad = useCallback(
    (pipeline: Pipeline) => {
      lastPipelineRef.current = null // Reset dedup so restore fires
      usePipelineStore.getState().setActivePipeline(pipeline)
    },
    [],
  )

  const handleDelete = useCallback(
    async (id: number) => {
      await removePipeline(id)
    },
    [removePipeline],
  )

  const handleClear = useCallback(() => {
    setNodes([])
    setEdges([])
    usePipelineStore.getState().setActivePipeline(null)
    setDirty(false)
    clearRun()
  }, [setNodes, setEdges, setDirty, clearRun])

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  const handleExecute = useCallback(async () => {
    const def = getDefinition()
    let pipeId: number

    if (!activePipeline || activePipeline.id <= 0) {
      // No saved pipeline (or compiled workflow) — auto-save first
      const name = activePipeline?.name ?? 'Untitled Pipeline'
      const desc = activePipeline?.description ?? ''
      const saved = await savePipeline(name, desc, def)
      pipeId = saved.id
    } else {
      // Update existing saved pipeline, then run
      await updatePipeline(activePipeline.id, { definition: JSON.stringify(def) })
      pipeId = activePipeline.id
    }

    await executePipelineRun(pipeId)
    setExecPanelExpanded(true)
  }, [activePipeline, getDefinition, savePipeline, updatePipeline, executePipelineRun])

  const handleStop = useCallback(() => {
    if (activeRun) {
      cancelRun(activeRun.runId)
    }
  }, [activeRun, cancelRun])

  // Can we run?
  const canExecute = hasStartNode && nodes.length > 1 && !isRunning

  // ---------------------------------------------------------------------------
  // Change handlers (with dirty tracking)
  // ---------------------------------------------------------------------------

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes)
      if (changes.some((c) => c.type === 'remove' || c.type === 'position')) {
        setDirty(true)
      }
    },
    [onNodesChange, setDirty],
  )

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes)
      if (changes.some((c) => c.type === 'remove')) {
        setDirty(true)
      }
    },
    [onEdgesChange, setDirty],
  )

  // ---------------------------------------------------------------------------
  // Render config dialog for correct node type
  // ---------------------------------------------------------------------------

  const renderConfigDialog = () => {
    if (!configNode) return null

    const nodeType = configNode.type

    switch (nodeType) {
      case 'tool':
        return (
          <ToolConfigDialog
            node={configNode}
            module={(configNode.data as unknown as ToolNodeData).module}
            onClose={() => setConfigNode(null)}
            onSave={handleToolConfigSave}
          />
        )
      case 'condition':
        return (
          <ConditionConfigDialog
            node={configNode}
            onClose={() => setConfigNode(null)}
            onSave={handleGenericConfigSave}
          />
        )
      case 'for-each':
        return (
          <ForEachConfigDialog
            node={configNode}
            onClose={() => setConfigNode(null)}
            onSave={handleGenericConfigSave}
          />
        )
      case 'delay':
        return (
          <DelayConfigDialog
            node={configNode}
            onClose={() => setConfigNode(null)}
            onSave={handleGenericConfigSave}
          />
        )
      case 'start':
        return (
          <StartConfigDialog
            node={configNode}
            onClose={() => setConfigNode(null)}
            onSave={handleGenericConfigSave}
          />
        )
      case 'note':
        return (
          <NoteConfigDialog
            node={configNode}
            onClose={() => setConfigNode(null)}
            onSave={handleGenericConfigSave}
          />
        )
      case 'shell':
        return (
          <ShellConfigDialog
            node={configNode}
            onClose={() => setConfigNode(null)}
            onSave={handleGenericConfigSave}
          />
        )
      case 'prompt':
        return (
          <PromptConfigDialog
            node={configNode}
            onClose={() => setConfigNode(null)}
            onSave={handleGenericConfigSave}
          />
        )
      case 'set-variable':
        return (
          <SetVariableConfigDialog
            node={configNode}
            onClose={() => setConfigNode(null)}
            onSave={handleGenericConfigSave}
          />
        )
      default:
        return null
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full">
      {/* Tool palette sidebar */}
      <ToolPalette
        onAddToolNode={handleAddToolNode}
        onAddLogicNode={handleAddLogicNode}
        hasStartNode={hasStartNode}
      />

      {/* Flow canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={isRunning ? [] : ['Backspace', 'Delete']}
          className="bg-bg-base"
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: 'var(--accent-primary)' },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent-primary)' },
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--border)"
          />
          <Controls
            className="!bg-bg-surface !border-border !rounded-lg [&>button]:!bg-bg-elevated [&>button]:!border-border [&>button]:!text-text-secondary [&>button:hover]:!bg-bg-surface"
            showInteractive={false}
          />
          <MiniMap
            className="!bg-bg-surface !border-border !rounded-lg"
            nodeColor={(node) => {
              switch (node.type) {
                case 'start': return 'var(--accent-primary)'
                case 'condition': return '#f59e0b'
                case 'for-each': return '#60a5fa'
                case 'delay': return '#6b7280'
                case 'note': return '#eab308'
                case 'shell': return '#10b981'
                case 'prompt': return '#8b5cf6'
                case 'set-variable': return '#06b6d4'
                default: return 'var(--accent-primary)'
              }
            }}
            maskColor="rgba(0,0,0,0.7)"
          />

          {/* Top-left: back + name */}
          <Panel position="top-left" className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('workflow-view', {})}
            >
              <ArrowLeft size={14} className="mr-1" />
              Back
            </Button>
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-medium text-text-primary">
              {activePipeline?.name ?? 'New Pipeline'}
              {dirty && <span className="text-accent-primary ml-1">*</span>}
            </span>
          </Panel>

          {/* Top-right: actions */}
          <Panel position="top-right" className="flex items-center gap-1.5">
            {/* Execute button */}
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={!canExecute}
              title={
                !hasStartNode ? 'Add a Start node first' :
                nodes.length <= 1 ? 'Add more nodes' :
                isRunning ? 'Pipeline is running' :
                'Run pipeline'
              }
            >
              <Play size={14} className="mr-1" />
              Run
            </Button>
            {isRunning && (
              <Button variant="secondary" size="sm" onClick={handleStop}>
                <Square size={14} className="mr-1 text-red-400" />
                Stop
              </Button>
            )}
            <div className="h-4 w-px bg-border" />
            <Button variant="secondary" size="sm" onClick={() => setShowLoad(true)}>
              <FolderOpen size={14} className="mr-1" />
              Load
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowSave(true)}
              disabled={nodes.length === 0}
            >
              <Save size={14} className="mr-1" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={nodes.length === 0 || isRunning}
            >
              <Trash2 size={14} className="mr-1" />
              Clear
            </Button>
          </Panel>

          {/* Empty state */}
          {nodes.length === 0 && (
            <Panel position="top-center" className="mt-[30vh]">
              <div className="text-center">
                <p className="text-text-secondary text-sm mb-1">
                  Add a Start node, then drag tools to build a pipeline
                </p>
                <p className="text-text-muted text-xs">
                  Double-click nodes to configure. Connect nodes to define execution order.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* Node count + edge count */}
        {nodes.length > 0 && !activeRun && (
          <div className="absolute bottom-2 left-[calc(14rem+0.5rem)] text-[10px] text-text-muted z-10">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {edges.length} connection{edges.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Execution progress panel */}
        {activeRun && (
          <ExecutionPanel
            run={activeRun}
            onStop={handleStop}
            expanded={execPanelExpanded}
            onToggle={() => setExecPanelExpanded(!execPanelExpanded)}
          />
        )}
      </div>

      {/* Dialogs */}
      {renderConfigDialog()}
      {showSave && (
        <SaveDialog
          pipeline={activePipeline}
          onClose={() => setShowSave(false)}
          onSave={handleSave}
        />
      )}
      {showLoad && (
        <LoadDialog
          onClose={() => setShowLoad(false)}
          onLoad={handleLoad}
          onDelete={handleDelete}
        />
      )}
      {configEdge && (
        <EdgeConfigDialog
          sourceNodeLabel={nodes.find((n) => n.id === configEdge.source)?.data?.label as string ?? configEdge.source}
          targetNodeLabel={nodes.find((n) => n.id === configEdge.target)?.data?.label as string ?? configEdge.target}
          mappings={(configEdge.data as { dataMappings?: DataMappingEntry[] })?.dataMappings ?? []}
          onClose={() => setConfigEdge(null)}
          onSave={handleEdgeMappingSave}
        />
      )}
      {activePrompt && (
        <PromptDialog
          prompt={activePrompt}
          onClose={() => setActivePrompt(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializeNode(n: Node): PipelineNodeV2 {
  const type = (n.type ?? 'tool') as NodeType
  const data = n.data as unknown as AnyNodeData

  switch (type) {
    case 'tool': {
      const d = data as ToolNodeData
      return {
        id: n.id,
        type: 'tool',
        config: { toolId: d.toolId, args: d.args, onFailure: d.onFailure, timeout: d.timeout },
        position: n.position,
      }
    }
    case 'condition': {
      const d = data as ConditionNodeData
      return {
        id: n.id,
        type: 'condition',
        config: { expression: d.expression, label: d.label },
        position: n.position,
      }
    }
    case 'for-each': {
      const d = data as ForEachNodeData
      return {
        id: n.id,
        type: 'for-each',
        config: { expression: d.expression, itemVariable: d.itemVariable, parallel: d.parallel },
        position: n.position,
      }
    }
    case 'delay': {
      const d = data as DelayNodeData
      return {
        id: n.id,
        type: 'delay',
        config: { seconds: d.seconds, reason: d.reason },
        position: n.position,
      }
    }
    case 'note': {
      const d = data as NoteNodeData
      return {
        id: n.id,
        type: 'note',
        config: { content: d.content, color: d.color },
        position: n.position,
      }
    }
    case 'start': {
      const d = data as StartNodeData
      return {
        id: n.id,
        type: 'start',
        config: { targetSource: d.targetSource, targetId: d.targetId, label: d.label },
        position: n.position,
      }
    }
    case 'shell': {
      const d = data as ShellNodeData
      return {
        id: n.id,
        type: 'shell',
        config: {
          command: d.command,
          cwd: d.cwd,
          timeout: d.timeout,
          onFailure: d.onFailure,
          captureOutput: d.captureVariable ? {
            variable: d.captureVariable,
            mode: d.captureMode ?? 'full',
            pattern: d.capturePattern,
          } : undefined,
        },
        position: n.position,
      }
    }
    case 'prompt': {
      const d = data as PromptNodeData
      return {
        id: n.id,
        type: 'prompt',
        config: {
          message: d.message,
          type: d.promptType,
          options: d.options,
          default: d.default,
          variable: d.variable,
          timeout: d.timeout,
        },
        position: n.position,
      }
    }
    case 'set-variable': {
      const d = data as SetVariableNodeData
      return {
        id: n.id,
        type: 'set-variable',
        config: { variable: d.variable, value: d.value },
        position: n.position,
      }
    }
    default:
      return {
        id: n.id,
        type: 'tool',
        config: { toolId: '', args: {} },
        position: n.position,
      }
  }
}

function deserializeNodes(def: PipelineDefinition, modules: Module[]): Node[] {
  const isV2 = def.version === 2 || def.nodes.some((n) => 'type' in n && 'config' in n)

  return def.nodes.map((pn) => {
    if (isV2 && 'type' in pn && 'config' in pn) {
      const v2 = pn as PipelineNodeV2
      return v2NodeToReactFlow(v2, modules)
    }

    // V1 fallback: treat as tool node
    const v1 = pn as PipelineNodeV1
    const mod = modules.find((m) => m.id === v1.toolId)
    return {
      id: v1.id,
      type: 'tool',
      position: v1.position,
      data: {
        label: mod?.name ?? v1.toolId,
        toolId: v1.toolId,
        module: mod,
        args: v1.args ?? {},
        configured: Object.keys(v1.args ?? {}).length > 0,
      } satisfies ToolNodeData,
    }
  })
}

function v2NodeToReactFlow(v2: PipelineNodeV2, modules: Module[]): Node {
  switch (v2.type) {
    case 'tool': {
      const cfg = v2.config as { toolId: string; args: Record<string, unknown>; onFailure?: StepFailureAction; timeout?: number }
      const mod = modules.find((m) => m.id === cfg.toolId)
      return {
        id: v2.id,
        type: 'tool',
        position: v2.position,
        data: {
          label: mod?.name ?? cfg.toolId,
          toolId: cfg.toolId,
          module: mod,
          args: cfg.args ?? {},
          configured: Object.keys(cfg.args ?? {}).length > 0,
          onFailure: cfg.onFailure,
          timeout: cfg.timeout,
        } satisfies ToolNodeData,
      }
    }
    case 'condition': {
      const cfg = v2.config as { expression: string; label?: string }
      return {
        id: v2.id,
        type: 'condition',
        position: v2.position,
        data: {
          expression: cfg.expression,
          label: cfg.label,
          configured: !!cfg.expression,
        } satisfies ConditionNodeData,
      }
    }
    case 'for-each': {
      const cfg = v2.config as { expression: string; itemVariable?: string; parallel?: boolean }
      return {
        id: v2.id,
        type: 'for-each',
        position: v2.position,
        data: {
          expression: cfg.expression,
          itemVariable: cfg.itemVariable ?? 'item',
          parallel: cfg.parallel ?? false,
          configured: !!cfg.expression,
        } satisfies ForEachNodeData,
      }
    }
    case 'delay': {
      const cfg = v2.config as { seconds: number; reason?: string }
      return {
        id: v2.id,
        type: 'delay',
        position: v2.position,
        data: {
          seconds: cfg.seconds,
          reason: cfg.reason,
          configured: true,
        } satisfies DelayNodeData,
      }
    }
    case 'note': {
      const cfg = v2.config as { content: string; color?: string }
      return {
        id: v2.id,
        type: 'note',
        position: v2.position,
        data: {
          content: cfg.content,
          color: (cfg.color as NoteNodeData['color']) ?? 'default',
          configured: true,
        } satisfies NoteNodeData,
      }
    }
    case 'start': {
      const cfg = v2.config as { targetSource?: string; targetId?: number; label?: string }
      return {
        id: v2.id,
        type: 'start',
        position: v2.position,
        data: {
          targetSource: (cfg.targetSource as StartNodeData['targetSource']) ?? 'selected',
          targetId: cfg.targetId,
          label: cfg.label,
          configured: true,
        } satisfies StartNodeData,
      }
    }
    case 'shell': {
      const cfg = v2.config as ShellNodeConfig
      return {
        id: v2.id,
        type: 'shell',
        position: v2.position,
        data: {
          command: cfg.command,
          cwd: cfg.cwd,
          timeout: cfg.timeout,
          onFailure: cfg.onFailure,
          captureVariable: cfg.captureOutput?.variable,
          captureMode: cfg.captureOutput?.mode,
          capturePattern: cfg.captureOutput?.pattern,
          configured: !!cfg.command,
        } satisfies ShellNodeData,
      }
    }
    case 'prompt': {
      const cfg = v2.config as PromptNodeConfig
      return {
        id: v2.id,
        type: 'prompt',
        position: v2.position,
        data: {
          message: cfg.message,
          promptType: cfg.type,
          options: cfg.options,
          default: cfg.default,
          variable: cfg.variable,
          timeout: cfg.timeout,
          configured: !!cfg.message && !!cfg.variable,
        } satisfies PromptNodeData,
      }
    }
    case 'set-variable': {
      const cfg = v2.config as SetVariableNodeConfig
      return {
        id: v2.id,
        type: 'set-variable',
        position: v2.position,
        data: {
          variable: cfg.variable,
          value: cfg.value,
          configured: !!cfg.variable && !!cfg.value,
        } satisfies SetVariableNodeData,
      }
    }
    default:
      return {
        id: v2.id,
        type: 'tool',
        position: v2.position,
        data: { label: 'Unknown', toolId: '', args: {}, configured: false } satisfies ToolNodeData,
      }
  }
}

function deserializeEdges(pipelineEdges: PipelineDefinition['edges']): Edge[] {
  return pipelineEdges.map((e) => {
    const isTrue = e.sourceHandle === 'true'
    const isFalse = e.sourceHandle === 'false'
    const isConditional = isTrue || isFalse

    let style = { stroke: 'var(--accent-primary)' }
    let label: string | undefined
    let markerColor = 'var(--accent-primary)'

    if (isTrue) {
      style = { stroke: '#4ade80' }
      label = 'TRUE'
      markerColor = '#4ade80'
    } else if (isFalse) {
      style = { stroke: '#f87171' }
      label = 'FALSE'
      markerColor = '#f87171'
    }

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      animated: true,
      style,
      label,
      labelStyle: isConditional ? { fill: style.stroke, fontWeight: 600, fontSize: 10 } : undefined,
      labelBgStyle: isConditional ? { fill: 'var(--bg-base)', fillOpacity: 0.8 } : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: markerColor },
      data: {
        sourceHandle: e.sourceHandle,
        dataMappings: e.dataMappings ?? [],
        dataMapping: e.dataMapping,
      },
    }
  })
}

// ---------------------------------------------------------------------------
// Exported wrapper with provider
// ---------------------------------------------------------------------------

export function PipelineBuilder({ pipelineId }: { pipelineId?: number }) {
  return (
    <ReactFlowProvider>
      <PipelineFlow pipelineId={pipelineId} />
    </ReactFlowProvider>
  )
}
