import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import { useFlow } from '../../flow/FlowContext';
import { nodeTypes } from '../../flow/NodeTypes';

export default function FlowCanvas({ className = '' }) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useFlow();

  return (
    <div className={`w-full h-full relative overflow-hidden bg-slate-50/50 ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2.0}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
        <Controls className="!bg-white !border !border-slate-200 !shadow-md !rounded-xl overflow-hidden" />
        <MiniMap
          nodeColor={(n) => {
            if (n.type?.includes('Source')) return '#3b82f6';
            if (n.type?.includes('Scope') || n.type?.includes('Range')) return '#9333ea';
            if (n.type?.includes('Audit')) return '#e11d48';
            if (n.type?.includes('Compare')) return '#059669';
            return '#f59e0b';
          }}
          className="!bg-white/90 !border !border-slate-200 !rounded-xl !shadow-md overflow-hidden"
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}
