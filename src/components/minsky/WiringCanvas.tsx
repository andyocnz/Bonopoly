// ── Wiring Canvas Component ──
// ReactFlow-based visual node editor for stock-flow diagram wiring.

import { useCallback, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeProps,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { MinskyModel, MinskyVariable, MinskyOperation, VariableType, OperationType } from '../../types/minsky'

// ─── Custom Node Components ────────────────────────────────────

const VARIABLE_COLORS: Record<VariableType, string> = {
  stock: '#2563eb',
  flow: '#16a34a',
  parameter: '#f59e0b',
  constant: '#6b7280',
}

const OPERATION_SYMBOLS: Record<OperationType, string> = {
  add: '+',
  subtract: '\u2212',
  multiply: '\u00d7',
  divide: '\u00f7',
  negate: '\u00b1',
  integrate: '\u222b',
}

type VariableNodeData = {
  label: string
  varType: VariableType
  currentValue: number
  unit?: string
}

function VariableNodeComponent({ data }: NodeProps<Node<VariableNodeData>>) {
  const color = VARIABLE_COLORS[data.varType]
  const isStock = data.varType === 'stock'
  return (
    <div
      className="minsky-node minsky-variable-node"
      style={{
        borderColor: color,
        borderWidth: isStock ? 3 : 1,
        borderStyle: isStock ? 'double' : 'solid',
      }}
    >
      <Handle type="target" position={Position.Left} className="minsky-handle" />
      <div className="minsky-node-label" style={{ color }}>{data.label}</div>
      <div className="minsky-node-value">
        {data.currentValue.toFixed(2)}
        {data.unit ? <span className="minsky-node-unit"> {data.unit}</span> : null}
      </div>
      <Handle type="source" position={Position.Right} className="minsky-handle" />
    </div>
  )
}

type OperationNodeData = {
  label: string
  opType: OperationType
}

function OperationNodeComponent({ data }: NodeProps<Node<OperationNodeData>>) {
  return (
    <div className="minsky-node minsky-operation-node">
      <Handle type="target" position={Position.Left} className="minsky-handle" id="input-0" />
      <Handle
        type="target"
        position={Position.Left}
        className="minsky-handle"
        id="input-1"
        style={{ top: '75%' }}
      />
      <div className="minsky-op-symbol">{OPERATION_SYMBOLS[data.opType]}</div>
      <Handle type="source" position={Position.Right} className="minsky-handle" />
    </div>
  )
}

type GodleyNodeData = {
  label: string
  columns: string[]
}

function GodleyNodeComponent({ data }: NodeProps<Node<GodleyNodeData>>) {
  return (
    <div className="minsky-node minsky-godley-node">
      <Handle type="target" position={Position.Top} className="minsky-handle" />
      <div className="minsky-godley-node-title">{data.label}</div>
      <div className="minsky-godley-node-cols">
        {data.columns.map((col, i) => (
          <span key={i} className="minsky-godley-node-col">{col}</span>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="minsky-handle" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  variable: VariableNodeComponent,
  operation: OperationNodeComponent,
  godley: GodleyNodeComponent,
}

// ─── Main Component ──────────────────────────────────────────

interface WiringCanvasProps {
  model: MinskyModel
  currentValues: Map<string, number>
  onModelChange: (updater: (model: MinskyModel) => MinskyModel) => void
}

function buildVariableNode(v: MinskyVariable, currentValue: number): Node {
  return {
    id: v.id,
    type: 'variable',
    position: v.position ?? { x: 0, y: 0 },
    data: {
      label: v.name,
      varType: v.type,
      currentValue,
      unit: v.unit,
    },
  }
}

function buildOperationNode(op: MinskyOperation): Node {
  return {
    id: op.id,
    type: 'operation',
    position: op.position ?? { x: 0, y: 0 },
    data: {
      label: op.id,
      opType: op.type,
    },
  }
}

function buildNodesFromModel(model: MinskyModel, values: Map<string, number>): Node[] {
  const result: Node[] = []

  for (const v of Object.values(model.variables)) {
    if (v.id.startsWith('_')) continue
    result.push(buildVariableNode(v, values.get(v.id) ?? v.value))
  }

  for (const op of Object.values(model.operations)) {
    result.push(buildOperationNode(op))
  }

  for (const table of model.godleyTables) {
    result.push({
      id: `godley-${table.id}`,
      type: 'godley',
      position: { x: 300, y: 700 + model.godleyTables.indexOf(table) * 120 },
      data: {
        label: table.title,
        columns: table.columns.map(c => c.name),
      },
    })
  }

  return result
}

function buildEdgesFromModel(model: MinskyModel): Edge[] {
  return model.wires.map(w => ({
    id: w.id,
    source: w.from,
    target: w.to,
    sourceHandle: w.fromPort === 'output' ? undefined : w.fromPort,
    targetHandle: w.toPort === 'output' ? undefined : w.toPort,
    animated: true,
    style: { stroke: 'var(--minsky-wire, #4a9eff)', strokeWidth: 1.5 },
  }))
}

export function WiringCanvas({ model, currentValues, onModelChange }: WiringCanvasProps) {
  // Use React state for nodes/edges so ReactFlow properly detects changes
  const [nodes, setNodes] = useState<Node[]>(() => buildNodesFromModel(model, currentValues))
  const [edges, setEdges] = useState<Edge[]>(() => buildEdgesFromModel(model))

  // Sync node DATA (values) from simulation — update only the data, preserve positions
  useEffect(() => {
    setNodes(prev =>
      prev.map(node => {
        if (node.type === 'variable') {
          const val = currentValues.get(node.id) ?? 0
          const v = model.variables[node.id]
          return {
            ...node,
            data: {
              ...node.data,
              currentValue: val,
              label: v?.name ?? node.data.label,
              varType: v?.type ?? node.data.varType,
              unit: v?.unit ?? node.data.unit,
            },
          }
        }
        return node
      })
    )
  }, [currentValues, model.variables])

  // Sync full node set when model structure changes (add/remove variables)
  useEffect(() => {
    setNodes(buildNodesFromModel(model, currentValues))
    setEdges(buildEdgesFromModel(model))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.godleyTables, model.operations, model.wires])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes(prev => {
        const updated = applyNodeChanges(changes, prev)
        // Sync position changes back to model (only for drag events)
        const hasDrag = changes.some(c => c.type === 'position' && c.dragging === false)
        if (hasDrag) {
          onModelChange(prev2 => {
            const next = { ...prev2, variables: { ...prev2.variables }, operations: { ...prev2.operations } }
            for (const node of updated) {
              if (next.variables[node.id]) {
                next.variables[node.id] = { ...next.variables[node.id], position: node.position }
              } else if (next.operations[node.id]) {
                next.operations[node.id] = { ...next.operations[node.id], position: node.position }
              }
            }
            return next
          })
        }
        return updated
      })
    },
    [onModelChange]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(prev => {
        const updated = applyEdgeChanges(changes, prev)
        onModelChange(prev2 => ({
          ...prev2,
          wires: updated.map(e => ({
            id: e.id,
            from: e.source,
            to: e.target,
            fromPort: e.sourceHandle ?? 'output',
            toPort: e.targetHandle ?? 'input-0',
          })),
        }))
        return updated
      })
    },
    [onModelChange]
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges(prev => {
        const updated = addEdge(
          { ...connection, animated: true, style: { stroke: 'var(--minsky-wire, #4a9eff)', strokeWidth: 1.5 } },
          prev
        )
        onModelChange(prev2 => ({
          ...prev2,
          wires: updated.map(e => ({
            id: e.id,
            from: e.source,
            to: e.target,
            fromPort: (e as Edge).sourceHandle ?? 'output',
            toPort: (e as Edge).targetHandle ?? 'input-0',
          })),
        }))
        return updated
      })
    },
    [onModelChange]
  )

  return (
    <div className="minsky-wiring-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ animated: true }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--minsky-bg-dots, #333)" gap={20} />
        <Controls
          showInteractive={false}
          style={{ background: 'var(--minsky-controls-bg, #1a1a2e)', borderColor: 'var(--minsky-border, #333)' }}
        />
        <MiniMap
          style={{ background: 'var(--minsky-minimap-bg, #111)' }}
          nodeColor={(node) => {
            if (node.type === 'variable') {
              const data = node.data as VariableNodeData
              return VARIABLE_COLORS[data.varType] ?? '#666'
            }
            if (node.type === 'godley') return '#8b5cf6'
            return '#666'
          }}
        />
      </ReactFlow>
    </div>
  )
}
