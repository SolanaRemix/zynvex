export const WORKFLOW_NODE_TYPES = [
  "START",
  "AI",
  "AGENT",
  "TOOL",
  "CONDITION",
  "LOOP",
  "PARALLEL",
  "HUMAN_APPROVAL",
  "WEBHOOK",
  "END"
] as const;

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];
export type WorkflowNodeStatus = "PENDING" | "READY" | "RUNNING" | "WAITING" | "COMPLETED" | "FAILED" | "SKIPPED";

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface WorkflowNodeDefinition {
  id: string;
  nodeType: WorkflowNodeType;
  name: string;
  config: Record<string, unknown>;
  dependsOn?: string[];
}

export interface WorkflowPlanStep {
  nodeId: string;
  batch: number;
}

export function normalizeWorkflowEdges(nodes: WorkflowNodeDefinition[], edges?: WorkflowEdge[]) {
  if (edges?.length) return edges;

  return nodes.flatMap((node) =>
    (node.dependsOn ?? []).map((from) => ({
      from,
      to: node.id
    }))
  );
}

export function validateWorkflowDefinition(nodes: WorkflowNodeDefinition[], edges?: WorkflowEdge[]) {
  if (nodes.length < 2) {
    throw new Error("Workflow must include at least two nodes.");
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const normalizedEdges = normalizeWorkflowEdges(nodes, edges);

  for (const node of nodes) {
    if (!WORKFLOW_NODE_TYPES.includes(node.nodeType)) {
      throw new Error(`Unsupported workflow node type: ${node.nodeType}`);
    }
  }

  for (const edge of normalizedEdges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Workflow edge references missing node: ${edge.from} -> ${edge.to}`);
    }
  }

  const starts = nodes.filter((node) => node.nodeType === "START");
  const ends = nodes.filter((node) => node.nodeType === "END");
  if (starts.length !== 1) throw new Error("Workflow must have exactly one START node.");
  if (ends.length < 1) throw new Error("Workflow must have at least one END node.");

  computeWorkflowBatches(nodes, normalizedEdges);
}

export function computeWorkflowBatches(nodes: WorkflowNodeDefinition[], edges?: WorkflowEdge[]): WorkflowPlanStep[] {
  const normalizedEdges = normalizeWorkflowEdges(nodes, edges);
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const depth = new Map<string, number>();

  for (const node of nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
    depth.set(node.id, 0);
  }

  for (const edge of normalizedEdges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }

  const ready = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
  const order: string[] = [];

  while (ready.length) {
    const current = ready.shift();
    if (!current) continue;
    order.push(current);

    for (const next of outgoing.get(current) ?? []) {
      const parentDepth = depth.get(current) ?? 0;
      depth.set(next, Math.max(depth.get(next) ?? 0, parentDepth + 1));
      incoming.set(next, (incoming.get(next) ?? 0) - 1);
      if ((incoming.get(next) ?? 0) === 0) ready.push(next);
    }
  }

  if (order.length !== nodes.length) {
    throw new Error("Workflow graph contains a cycle.");
  }

  return order.map((nodeId) => ({ nodeId, batch: depth.get(nodeId) ?? 0 }));
}

export function getRunnableNodeIds(
  nodes: WorkflowNodeDefinition[],
  completedNodeIds: string[],
  runningNodeIds: string[],
  edges?: WorkflowEdge[]
) {
  const done = new Set(completedNodeIds);
  const running = new Set(runningNodeIds);
  const normalizedEdges = normalizeWorkflowEdges(nodes, edges);
  const dependencies = new Map<string, string[]>();

  for (const node of nodes) dependencies.set(node.id, []);
  for (const edge of normalizedEdges) dependencies.get(edge.to)?.push(edge.from);

  return nodes
    .filter((node) => !done.has(node.id) && !running.has(node.id))
    .filter((node) => (dependencies.get(node.id) ?? []).every((dependency) => done.has(dependency)))
    .map((node) => node.id);
}
