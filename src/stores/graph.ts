import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "./workspace";

export interface GraphNode {
  path: string;
  label: string;
  degree: number;
  exists: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "wiki" | "md";
  unresolved: boolean;
}

export interface LinkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const useGraphStore = defineStore("graph", () => {
  const workspace = useWorkspaceStore();
  const graph = ref<LinkGraph | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastBuiltAt = ref<number | null>(null);
  const activatedOnce = ref(false);
  let inflightId = 0;

  const nodeCount = computed(() => graph.value?.nodes.length ?? 0);
  const edgeCount = computed(() => graph.value?.edges.length ?? 0);

  async function refreshGraph(force = false): Promise<void> {
    activatedOnce.value = true;
    if (workspace.rootPaths.length === 0) {
      graph.value = { nodes: [], edges: [] };
      lastBuiltAt.value = Date.now();
      return;
    }
    inflightId += 1;
    const myId = inflightId;
    loading.value = true;
    error.value = null;
    try {
      const result = await invoke<LinkGraph>("build_link_graph", {
        roots: workspace.rootPaths,
        refresh: force,
      });
      if (myId !== inflightId) return;
      graph.value = result;
      lastBuiltAt.value = Date.now();
    } catch (e) {
      if (myId !== inflightId) return;
      error.value = String(e);
      console.error("refreshGraph failed", e);
    } finally {
      if (myId === inflightId) loading.value = false;
    }
  }

  function getLocalGraph(filePath: string, hops = 1): LinkGraph {
    if (!graph.value) return { nodes: [], edges: [] };
    const key = filePath.replace(/\\/g, "/");
    const keepNodes = new Set<string>([key]);
    let frontier = new Set<string>([key]);
    for (let h = 0; h < hops; h++) {
      const next = new Set<string>();
      for (const e of graph.value.edges) {
        if (frontier.has(e.source) && !keepNodes.has(e.target)) {
          next.add(e.target);
          keepNodes.add(e.target);
        }
        if (frontier.has(e.target) && !keepNodes.has(e.source)) {
          next.add(e.source);
          keepNodes.add(e.source);
        }
      }
      if (next.size === 0) break;
      frontier = next;
    }
    const nodes = graph.value.nodes.filter((n) => keepNodes.has(n.path));
    const edges = graph.value.edges.filter(
      (e) => keepNodes.has(e.source) && keepNodes.has(e.target)
    );
    return { nodes, edges };
  }

  watch(
    () => workspace.rootPaths.join("\n"),
    (curr, prev) => {
      if (!activatedOnce.value) return;
      if (curr === prev) return;
      refreshGraph(true);
    }
  );

  return {
    graph,
    loading,
    error,
    lastBuiltAt,
    activatedOnce,
    nodeCount,
    edgeCount,
    refreshGraph,
    getLocalGraph,
  };
});
