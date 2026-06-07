interface TreeData {
  id: string;
  name: string | null;
  earnings: number;
  children_count: number;
  children: TreeData[];
}

function layoutTree(
  tree: TreeData,
  x = 0,
  y = 0,
  depth = 0,
  spacing = { x: 250, y: 140 }
) {
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
    sourcePosition: 'bottom',
    targetPosition: 'top',
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

self.onmessage = (e: MessageEvent) => {
  const { tree } = e.data;
  if (!tree) {
    self.postMessage({ error: 'No tree data provided' });
    return;
  }
  try {
    const result = layoutTree(tree);
    self.postMessage(result);
  } catch (err: any) {
    self.postMessage({ error: err.message || 'Error executing layoutTree' });
  }
};
