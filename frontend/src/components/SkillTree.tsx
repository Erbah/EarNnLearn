"use client";

import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Edge, 
  Node,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2, Play, Sparkles } from 'lucide-react';

// Custom Node Component
const ForestNode = React.memo(function ForestNode({ data }: any) {
  const isLocked = data.status === "LOCKED";
  const isCompleted = data.status === "COMPLETED";
  
  const handleClick = React.useCallback(() => {
    if (!isLocked) {
      data.onNodeClick?.(data.id, data.course_id);
    }
  }, [isLocked, data.onNodeClick, data.id, data.course_id]);

  return (
    <div 
      onClick={handleClick}
      className={`relative group p-1 rounded-full transition-all duration-500 ${isLocked ? 'grayscale opacity-60 cursor-not-allowed' : 'hover:scale-110 shadow-[0_0_30px_rgba(0,224,255,0.2)] cursor-pointer'}`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
        isCompleted ? 'bg-primary/20 border-primary shadow-[0_0_20px_rgba(0,224,255,0.4)]' : 
        isLocked ? 'bg-white/5 border-white/10' : 
        'bg-background border-primary border-dashed animate-pulse-slow shadow-[0_0_15px_rgba(0,224,255,0.3)]'
      }`}>
        {isLocked ? (
          <Lock className="w-6 h-6 text-gray-500" />
        ) : isCompleted ? (
          <CheckCircle2 className="w-8 h-8 text-primary" />
        ) : (
          <Play className="w-8 h-8 text-white fill-current" />
        )}
        
        {/* Flare effect for current node */}
        {!isLocked && !isCompleted && (
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping pointer-events-none" />
        )}
      </div>

      {/* Label */}
      <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
        <p className={`text-xs font-black tracking-widest uppercase transition-colors ${isLocked ? 'text-gray-600' : 'text-white'}`}>
          {data.label}
        </p>
        {!isLocked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-1 mt-1"
          >
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-primary font-bold">{data.xp || 100} XP</span>
          </motion.div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

const nodeTypes = {
  forestNode: ForestNode,
};

interface SkillTreeProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (nodeId: string, courseId: string) => void;
}

export const SkillTree = React.memo(function SkillTree({ nodes, edges, onNodeClick }: SkillTreeProps) {
  const nodesWithClick = useMemo(() => 
    nodes.map(n => ({
      ...n,
      data: { ...n.data, id: n.id, course_id: (n.data as any).course_id, onNodeClick }
    })), [nodes, onNodeClick]
  );

  return (
    <div className="w-full h-[600px] bg-background/50 rounded-3xl border border-white/5 overflow-hidden relative">
      <ReactFlow
        key={nodes.length}
        nodes={nodesWithClick}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        snapToGrid
        snapGrid={[20, 20]}
        panOnScroll
        selectionOnDrag
        zoomOnScroll={false}
        colorMode="dark"
      >
        <Background color="#1e293b" gap={20} />
      </ReactFlow>
    </div>
  );
});
