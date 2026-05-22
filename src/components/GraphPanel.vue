<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { Icon } from "@iconify/vue";
import { useGraphStore, type GraphNode, type LinkGraph } from "../stores/graph";
import { useTabsStore } from "../stores/tabs";
import { useWorkspaceStore } from "../stores/workspace";
import { useUiStore } from "../stores/ui";
import { useI18n } from "../i18n";

const graph = useGraphStore();
const tabs = useTabsStore();
const workspace = useWorkspaceStore();
const ui = useUiStore();
const { t } = useI18n();

const svgRef = ref<SVGSVGElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const mode = ref<"local" | "full">("full");
const searchQuery = ref("");
const dims = ref({ w: 400, h: 400 });
const LARGE_NODE_THRESHOLD = 2000;

let d3mod: typeof import("d3") | null = null;
// d3 simulation typings are notoriously fiddly with custom node shapes — use any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let simulation: any = null;
let resizeObserver: ResizeObserver | null = null;

type SimNode = GraphNode & { x?: number; y?: number; fx?: number | null; fy?: number | null };
type SimEdge = { source: SimNode | string; target: SimNode | string; kind: string; unresolved: boolean };

const tooLarge = computed(
  () => (graph.graph?.nodes.length ?? 0) > LARGE_NODE_THRESHOLD
);

const effectiveMode = computed<"local" | "full">(() => {
  if (tooLarge.value) return "local";
  return mode.value;
});

const subgraph = computed<LinkGraph>(() => {
  if (!graph.graph) return { nodes: [], edges: [] };
  if (effectiveMode.value === "full") return graph.graph;
  const active = tabs.activePath?.replace(/\\/g, "/");
  if (!active) return graph.graph;
  return graph.getLocalGraph(active, 1);
});

const isEmpty = computed(() => subgraph.value.nodes.length === 0);

async function ensureD3() {
  if (!d3mod) d3mod = await import("d3");
}

function nodeRadius(n: GraphNode): number {
  return Math.sqrt(Math.max(1, n.degree)) * 3 + 4;
}

function colorForDegree(n: GraphNode, maxDegree: number): string {
  if (!n.exists) return "var(--text-muted, #888)";
  const ratio = maxDegree > 0 ? Math.min(1, n.degree / maxDegree) : 0;
  const accent = ratio > 0.66 ? "#f97316" : ratio > 0.33 ? "#3b82f6" : "#64748b";
  return accent;
}

function render() {
  if (!d3mod || !svgRef.value) return;
  const d3 = d3mod;
  const svg = d3.select(svgRef.value);
  svg.selectAll("*").remove();

  const data = subgraph.value;
  if (!data.nodes.length) {
    if (simulation) {
      simulation.stop();
      simulation = null;
    }
    return;
  }

  const { w, h } = dims.value;
  svg.attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h);

  const defs = svg.append("defs");
  defs
    .append("marker")
    .attr("id", "graph-arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 12)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "var(--text-muted, #888)");

  const root = svg.append("g").attr("class", "zoom-layer");

  const nodeMap = new Map<string, SimNode>();
  for (const n of data.nodes) {
    nodeMap.set(n.path, { ...n });
  }
  const simNodes: SimNode[] = Array.from(nodeMap.values());
  const simEdges: SimEdge[] = data.edges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
      unresolved: e.unresolved,
    }));

  const maxDegree = simNodes.reduce((m, n) => Math.max(m, n.degree), 0);

  const edgeSel = root
    .append("g")
    .attr("class", "edges")
    .attr("stroke", "var(--text-muted, #888)")
    .attr("stroke-opacity", 0.4)
    .selectAll<SVGLineElement, SimEdge>("line")
    .data(simEdges)
    .enter()
    .append("line")
    .attr("stroke-dasharray", (e) => (e.unresolved ? "4 3" : null))
    .attr("data-source", (e) => (typeof e.source === "string" ? e.source : e.source.path))
    .attr("data-target", (e) => (typeof e.target === "string" ? e.target : e.target.path));

  const nodeSel = root
    .append("g")
    .attr("class", "nodes")
    .selectAll<SVGGElement, SimNode>("g")
    .data(simNodes, (d) => d.path)
    .enter()
    .append("g")
    .attr("class", "graph-node")
    .attr("data-path", (d) => d.path)
    .style("cursor", "pointer");

  nodeSel
    .append("circle")
    .attr("r", (d) => nodeRadius(d))
    .attr("fill", (d) => colorForDegree(d, maxDegree))
    .attr("stroke", "var(--bg, #111)")
    .attr("stroke-width", 1.5);

  nodeSel
    .append("text")
    .text((d) => d.label)
    .attr("y", (d) => nodeRadius(d) + 12)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("fill", "var(--text, #ddd)")
    .style("pointer-events", "none");

  nodeSel.append("title").text((d) => d.path);

  nodeSel
    .on("mouseenter", function (_evt, d) {
      const connected = new Set<string>([d.path]);
      for (const e of simEdges) {
        const s = typeof e.source === "string" ? e.source : e.source.path;
        const tg = typeof e.target === "string" ? e.target : e.target.path;
        if (s === d.path) connected.add(tg);
        if (tg === d.path) connected.add(s);
      }
      nodeSel.attr("opacity", (n) => (connected.has(n.path) ? 1 : 0.2));
      edgeSel.attr("stroke-opacity", (e) => {
        const s = typeof e.source === "string" ? e.source : e.source.path;
        const tg = typeof e.target === "string" ? e.target : e.target.path;
        return s === d.path || tg === d.path ? 1 : 0.1;
      });
    })
    .on("mouseleave", function () {
      nodeSel.attr("opacity", 1);
      edgeSel.attr("stroke-opacity", 0.4);
    })
    .on("click", async function (_evt, d) {
      if (!d.exists) return;
      await workspace.expandPathToNode(d.path);
      void tabs.openFile(d.path, d.label);
    });

  const drag = d3
    .drag<SVGGElement, SimNode>()
    .on("start", (evt, d) => {
      if (!evt.active && simulation) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (evt, d) => {
      d.fx = evt.x;
      d.fy = evt.y;
    })
    .on("end", (evt, d) => {
      if (!evt.active && simulation) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
  nodeSel.call(drag);

  const zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on("zoom", (evt) => {
      root.attr("transform", evt.transform.toString());
    });
  svg.call(zoomBehavior).on("dblclick.zoom", null);
  svg.on("dblclick", () => {
    svg.transition().duration(250).call(zoomBehavior.transform, d3.zoomIdentity);
  });

  if (simulation) simulation.stop();
  simulation = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      "link",
      d3
        .forceLink<SimNode, SimEdge>(simEdges)
        .id((d) => d.path)
        .distance(60)
        .strength(0.6)
    )
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(w / 2, h / 2))
    .force("collide", d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 6));

  simulation.on("tick", () => {
    edgeSel
      .attr("x1", (e) => (typeof e.source === "string" ? 0 : e.source.x ?? 0))
      .attr("y1", (e) => (typeof e.source === "string" ? 0 : e.source.y ?? 0))
      .attr("x2", (e) => (typeof e.target === "string" ? 0 : e.target.x ?? 0))
      .attr("y2", (e) => (typeof e.target === "string" ? 0 : e.target.y ?? 0));
    nodeSel.attr("transform", (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
  });

  applySearchHighlight();
}

function applySearchHighlight() {
  if (!svgRef.value) return;
  const q = searchQuery.value.trim().toLowerCase();
  const sel = (d3mod ? d3mod.select(svgRef.value) : null);
  if (!sel) return;
  sel
    .selectAll<SVGGElement, SimNode>(".graph-node")
    .attr("opacity", (d) => (q === "" || d.label.toLowerCase().includes(q) ? 1 : 0.15));
}

function onRefresh() {
  graph.refreshGraph(true);
}

function measure() {
  if (!containerRef.value) return;
  const r = containerRef.value.getBoundingClientRect();
  dims.value = {
    w: Math.max(200, Math.floor(r.width)),
    h: Math.max(200, Math.floor(r.height) - 36),
  };
}

let resizePending = false;
function scheduleResize() {
  if (resizePending) return;
  resizePending = true;
  requestAnimationFrame(() => {
    resizePending = false;
    const prev = dims.value;
    measure();
    if (prev.w === dims.value.w && prev.h === dims.value.h) return;
    render();
  });
}

onMounted(async () => {
  await ensureD3();
  measure();
  resizeObserver = new ResizeObserver(scheduleResize);
  if (containerRef.value) resizeObserver.observe(containerRef.value);
  if (!graph.graph) {
    await graph.refreshGraph(false);
  }
  render();
});

onBeforeUnmount(() => {
  if (simulation) {
    simulation.stop();
    simulation = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

watch(() => graph.graph, () => render(), { deep: false });
watch(
  () => tabs.activePath,
  () => {
    if (effectiveMode.value === "local") render();
  }
);
watch(mode, () => render());
watch(searchQuery, () => applySearchHighlight());
watch(() => ui.sidebarView, (v) => {
  if (v === "graph") {
    measure();
    render();
  }
});
</script>

<template>
  <div ref="containerRef" class="graph-panel">
    <div class="graph-toolbar">
      <input
        v-model="searchQuery"
        class="graph-search"
        :placeholder="t('graph.search')"
        type="text"
      />
      <div class="graph-mode-toggle">
        <button
          class="graph-mode-btn"
          :class="{ active: effectiveMode === 'local' }"
          :disabled="tooLarge"
          :title="t('graph.localGraph')"
          @click="mode = 'local'"
        >
          <Icon icon="lucide:scan" width="12" height="12" />
        </button>
        <button
          class="graph-mode-btn"
          :class="{ active: effectiveMode === 'full' }"
          :disabled="tooLarge"
          :title="t('graph.fullGraph')"
          @click="mode = 'full'"
        >
          <Icon icon="lucide:network" width="12" height="12" />
        </button>
      </div>
      <button
        class="graph-refresh-btn"
        :title="t('graph.refresh')"
        @click="onRefresh"
      >
        <Icon icon="lucide:refresh-cw" width="12" height="12" />
      </button>
    </div>

    <div v-if="graph.loading" class="graph-status-msg">{{ t("graph.loading") }}</div>
    <div v-else-if="tooLarge" class="graph-status-msg graph-warning">
      {{ t("graph.tooLarge") }}
    </div>
    <div v-else-if="isEmpty" class="graph-status-msg">{{ t("graph.empty") }}</div>

    <svg ref="svgRef" class="graph-svg" v-show="!isEmpty && !graph.loading"></svg>
  </div>
</template>

<style lang="scss" scoped>
.graph-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.graph-search {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  font-size: 11px;
  background: var(--bg-input, var(--bg));
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text);
  outline: none;

  &:focus {
    border-color: var(--accent);
  }
}

.graph-mode-toggle {
  display: flex;
  gap: 1px;
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.graph-mode-btn,
.graph-refresh-btn {
  height: 24px;
  width: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted, var(--text));
  cursor: pointer;
  padding: 0;

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text);
  }

  &.active {
    background: var(--accent);
    color: white;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.graph-refresh-btn {
  border: 1px solid var(--border);
  border-radius: 3px;
}

.graph-status-msg {
  padding: 16px 12px;
  font-size: 11px;
  color: var(--text-muted, var(--text));
  text-align: center;
}

.graph-warning {
  color: var(--accent);
}

.graph-svg {
  flex: 1;
  width: 100%;
  display: block;
  background: transparent;
}

:deep(.graph-node circle) {
  transition: opacity 0.15s ease;
}
</style>
