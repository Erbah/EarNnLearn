"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SkillTree } from "@/components/SkillTree";
import { motion } from "framer-motion";
import { TreePine, Sparkles, Map, Info } from "lucide-react";
import { Node, Edge } from "@xyflow/react";
import { API_BASE_URL, api } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

export default function PathPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTree();
  }, []);

  function handleNodeClick(nodeId: string, courseId: string) {
    if (courseId) {
      router.push(`/courses/${courseId}`);
    }
  }


  async function loadTree() {
    setLoading(true);
    try {
      const res = await api.get(`${API}/learn/tree`);
      const data = res.data;
      console.log("Learning Forest Data:", data);
      
      // Transform API nodes to ReactFlow nodes
      const rfNodes: Node[] = data.map((n: any) => ({
        id: n.id,
        position: { x: n.x_coord, y: n.y_coord },
        data: { 
          label: n.title, 
          status: n.status, 
          xp: 100, // Default for now
          node_type: n.node_type,
          course_id: n.course_id
        },
        type: 'forestNode',
      }));
      console.log("ReactFlow Nodes:", rfNodes);

      // Create edges from prerequisites
      const rfEdges: Edge[] = [];
      data.forEach((n: any) => {
        n.prerequisites.forEach((p: any) => {
          rfEdges.push({
            id: `e-${p.required_node_id}-${n.id}`,
            source: p.required_node_id,
            target: n.id,
            animated: n.status !== "LOCKED",
            style: { 
              stroke: n.status === "LOCKED" ? "#334155" : "#00e0ff", 
              strokeWidth: 2,
              opacity: n.status === "LOCKED" ? 0.3 : 1
            },
          });
        });
      });

      setNodes(rfNodes);
      setEdges(rfEdges);
    } catch (e: any) {
      console.error("Failed to load learning forest:", e.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <TreePine className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">The Learning Forest</h1>
          </div>
          <p className="text-gray-400">Navigate your personalized path to mastery and earn rewards.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-black">Current Chapter</p>
            <p className="text-sm font-bold text-white">Viral Distribution 101</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Map className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Main Map */}
        <div className="lg:col-span-3">
           {loading ? (
             <div className="w-full h-[600px] flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
               <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
               <p className="text-gray-500 font-medium">Generating your path...</p>
             </div>
           ) : (
             <SkillTree 
               nodes={nodes} 
               edges={edges} 
               onNodeClick={handleNodeClick} 
             />
           )}
        </div>

        {/* Legend & Stats */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-card border border-white/10 glass">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              Legend
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_10px_rgba(0,224,255,0.5)]" />
                <span className="text-sm text-gray-300">Unlocked & Ready</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-gray-600 opacity-50" />
                <span className="text-sm text-gray-500">Locked Node</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                <span className="text-sm text-gray-300">Completed Path</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-primary/10 border border-primary/20 relative overflow-hidden group">
            <Sparkles className="absolute -right-4 -top-4 w-24 h-24 text-primary/10 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold text-white mb-2">Pro Tip</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Completing nodes with a **Perfect Score** grants 2x XP and recovers one lost Heart!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
