'use client';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/* ───── Custom Node Component ───── */
function TreeNodeCard({ data }: { data: any }) {
  return (
    <div
      className={`bg-card/85 backdrop-blur-xl rounded-[14px] p-5 px-6 min-w-[180px] text-gray-200 transition-all duration-300 ${
        data.isRoot 
          ? 'border-2 border-primary shadow-[0_0_25px_rgba(0,224,255,0.3)]' 
          : 'border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}
    >
      <div className="text-[10px] text-primary font-mono mb-1.5 uppercase tracking-wider">
        {data.rid}
      </div>
      <div className="text-[14px] font-semibold mb-2 text-white">
        {data.name}
      </div>
      <div className="flex gap-4 text-[12px]">
        <div>
          <span className="text-secondary font-bold">
            GHS {data.earnings?.toFixed(2) || '0.00'}
          </span>
          <div className="text-gray-500 text-[10px] mt-0.5">Earned</div>
        </div>
        <div>
          <span className="font-bold text-gray-300">
            {data.childrenCount || 0}
          </span>
          <div className="text-gray-500 text-[10px] mt-0.5">Network</div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { treeNode: TreeNodeCard };

/* ───── Tree Layout Algorithm ───── */
interface TreeData {
  id: string;
  name: string | null;
  earnings: number;
  children_count: number;
  children: TreeData[];
}

function layoutTree(tree: TreeData, x = 0, y = 0, depth = 0, spacing = { x: 250, y: 140 }) {
  const nodes: any[] = [];
  const edges: any[] = [];

  nodes.push({
    id: tree.id,
    type: 'treeNode',
    position: { x, y },
    data: {
      rid: tree.id,
      name: tree.name || 'User',
      earnings: tree.earnings,
      childrenCount: tree.children_count,
      isRoot: depth === 0,
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  });

  if (tree.children && tree.children.length > 0) {
    const totalWidth = (tree.children.length - 1) * spacing.x;
    const startX = x - totalWidth / 2;

    tree.children.forEach((child, i) => {
      const childX = startX + i * spacing.x;
      const childY = y + spacing.y;

      edges.push({
        id: `e-${tree.id}-${child.id}`,
        source: tree.id,
        target: child.id,
        animated: true,
        style: { stroke: '#00E0FF', strokeWidth: 2, opacity: 0.6 },
      });

      const sub = layoutTree(child, childX, childY, depth + 1, spacing);
      nodes.push(...sub.nodes);
      edges.push(...sub.edges);
    });
  }

  return { nodes, edges };
}

/* ───── Main Component ───── */
export default function NetworkTree() {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTree() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/v1/network/tree-view`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) {
          setError('Failed to load network tree');
          setLoading(false);
          return;
        }
        
        const tree: TreeData = await res.json();
        const { nodes: layoutNodes, edges: layoutEdges } = layoutTree(tree);
        setNodes(layoutNodes);
        setEdges(layoutEdges);
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }
    fetchTree();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '500px', color: '#00E0FF' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌳</div>
          <div>Loading your network...</div>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '500px', color: '#E5E7EB' }}>
        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(27,36,51,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <div>{errorMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-white/5 bg-background shadow-inner">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background color="#1B2433" gap={20} />
        <Controls
          style={{ background: '#121826', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
        />
        <MiniMap
          style={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          nodeColor="#1B2433"
          maskColor="rgba(11, 15, 25, 0.8)"
        />
      </ReactFlow>
    </div>
  );
}
