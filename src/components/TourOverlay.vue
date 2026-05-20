<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useUiStore } from '../stores/ui';

const ui = useUiStore();

interface TourStep {
  title: string;
  description: string;
  selector: string | null;
  position: 'bottom' | 'top' | 'right' | 'left' | 'center';
}

const steps: TourStep[] = [
  {
    title: 'Welcome to mdview',
    description: 'A markdown editor for your workspace. Let us show you around.',
    selector: null,
    position: 'center',
  },
  {
    title: 'Add a workspace',
    description: 'Start by adding a folder or opening a .code-workspace file using the button below.',
    selector: '.sidebar-empty',
    position: 'right',
  },
  {
    title: 'File Explorer',
    description: 'Browse your files here. Click folders to expand, click .md files to open them.',
    selector: '.sidebar-body',
    position: 'right',
  },
  {
    title: 'Tabs',
    description: 'Open files appear as tabs. Drag to reorder, right-click for options, X to close.',
    selector: '.tab-bar',
    position: 'bottom',
  },
  {
    title: 'Editor Toolbar',
    description: 'Format text with the toolbar: Bold, Italic, Headings, Lists, Links, Images…',
    selector: '.md-toolbar',
    position: 'bottom',
  },
  {
    title: 'Live Preview',
    description: 'See a live-rendered preview of your markdown. Toggle dark/light theme, or export to PDF.',
    selector: '.preview-pane',
    position: 'left',
  },
  {
    title: 'Command Palette',
    description: 'Press Cmd/Ctrl+P to quickly open any .md file by name.',
    selector: null,
    position: 'center',
  },
  {
    title: 'Terminal',
    description: 'Press Cmd/Ctrl+` to open an integrated terminal at your workspace root.',
    selector: null,
    position: 'center',
  },
  {
    title: 'Settings',
    description: 'Click the gear icon to change theme, language, or check for updates.',
    selector: '.tab-bar-actions',
    position: 'bottom',
  },
];

const currentStep = computed(() => ui.tourStep);
const isLast = computed(() => currentStep.value === steps.length - 1);
const step = computed(() => steps[currentStep.value]);

// Spotlight rect
const spotlightRect = ref<{ top: number; left: number; width: number; height: number } | null>(null);
const tooltipStyle = ref<Record<string, string>>({});
const PADDING = 8;

function getSpotlight() {
  const sel = step.value?.selector;
  if (!sel) {
    spotlightRect.value = null;
    tooltipStyle.value = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    return;
  }
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) {
    spotlightRect.value = null;
    tooltipStyle.value = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    return;
  }
  const rect = el.getBoundingClientRect();
  spotlightRect.value = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  // Position tooltip relative to the spotlight
  const pos = step.value.position;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipW = 320;
  const tooltipH = 160;

  if (pos === 'bottom') {
    const top = Math.min(spotlightRect.value.top + spotlightRect.value.height + 12, vh - tooltipH - 12);
    const left = Math.max(12, Math.min(spotlightRect.value.left, vw - tooltipW - 12));
    tooltipStyle.value = { top: `${top}px`, left: `${left}px` };
  } else if (pos === 'top') {
    const top = Math.max(12, spotlightRect.value.top - tooltipH - 12);
    const left = Math.max(12, Math.min(spotlightRect.value.left, vw - tooltipW - 12));
    tooltipStyle.value = { top: `${top}px`, left: `${left}px` };
  } else if (pos === 'right') {
    const top = Math.max(12, Math.min(spotlightRect.value.top, vh - tooltipH - 12));
    const left = Math.min(spotlightRect.value.left + spotlightRect.value.width + 12, vw - tooltipW - 12);
    tooltipStyle.value = { top: `${top}px`, left: `${left}px` };
  } else if (pos === 'left') {
    const top = Math.max(12, Math.min(spotlightRect.value.top, vh - tooltipH - 12));
    const left = Math.max(12, spotlightRect.value.left - tooltipW - 12);
    tooltipStyle.value = { top: `${top}px`, left: `${left}px` };
  } else {
    tooltipStyle.value = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

function clipPath() {
  if (!spotlightRect.value) return 'none';
  const { top, left, width, height } = spotlightRect.value;
  const r = 4; // border-radius of spotlight
  // Use inset() clip-path to punch a hole
  const bottom = window.innerHeight - top - height;
  const right = window.innerWidth - left - width;
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${r}px)`;
}

const clipPathValue = ref('none');

function updatePositions() {
  getSpotlight();
  clipPathValue.value = clipPath();
}

let resizeObs: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => updatePositions());
  resizeObs = new ResizeObserver(() => updatePositions());
  resizeObs.observe(document.body);
  window.addEventListener('resize', updatePositions);
});

onBeforeUnmount(() => {
  resizeObs?.disconnect();
  window.removeEventListener('resize', updatePositions);
});

watch(() => ui.tourStep, async () => {
  await nextTick();
  updatePositions();
});

function next() {
  if (isLast.value) {
    void ui.skipTour();
  } else {
    ui.nextStep();
  }
}

function prev() {
  ui.prevStep();
}

function skip() {
  void ui.skipTour();
}
</script>

<template>
  <Teleport to="body">
    <div class="tour-overlay" @click.self="skip">
      <!-- Dim layer with spotlight cutout -->
      <div
        class="tour-dim"
        :style="{ '--clip': clipPathValue }"
      ></div>
      <!-- Spotlight border highlight -->
      <div
        v-if="spotlightRect"
        class="tour-spotlight-border"
        :style="{
          top: spotlightRect.top + 'px',
          left: spotlightRect.left + 'px',
          width: spotlightRect.width + 'px',
          height: spotlightRect.height + 'px',
        }"
      ></div>
      <!-- Tooltip card -->
      <div class="tour-tooltip" :style="tooltipStyle">
        <div class="tour-step-badge">{{ currentStep + 1 }} / {{ steps.length }}</div>
        <h3 class="tour-title">{{ step.title }}</h3>
        <p class="tour-desc">{{ step.description }}</p>
        <div class="tour-actions">
          <button class="tour-skip" @click="skip">Skip tour</button>
          <div class="tour-nav">
            <button v-if="currentStep > 0" class="tour-btn tour-btn-secondary" @click="prev">Back</button>
            <button class="tour-btn tour-btn-primary" @click="next">
              {{ isLast ? 'Finish' : 'Next' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.tour-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
}

.tour-dim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  /* Punch the spotlight hole using clip-path on a pseudo-element */
  pointer-events: auto;
}

/* We need TWO overlapping elements to create the hole effect:
   - A full-screen dim layer
   - MINUS the spotlight area
   We achieve this with the mix-blend-mode trick or with a shadow approach */
.tour-dim::after {
  content: '';
  position: absolute;
  inset: 0;
  background: transparent;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  clip-path: var(--clip, none);
}

/* Clear the base background when clip is active, show only the after shadow */
.tour-dim {
  background: transparent;
}

.tour-spotlight-border {
  position: fixed;
  pointer-events: none;
  border: 2px solid var(--accent, #0ea5e9);
  border-radius: 6px;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.15);
  z-index: 10001;
  transition: all 0.2s ease;
}

.tour-tooltip {
  position: fixed;
  width: 320px;
  background: var(--bg-sidebar, #252526);
  border: 1px solid var(--border, #3c3c3c);
  border-radius: 10px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  padding: 20px;
  z-index: 10002;
  pointer-events: auto;
  transition: top 0.2s ease, left 0.2s ease;
}

.tour-step-badge {
  font-size: 11px;
  color: var(--accent, #0ea5e9);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.tour-title {
  margin: 0 0 8px 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text, #cccccc);
  line-height: 1.3;
}

.tour-desc {
  margin: 0 0 16px 0;
  font-size: 13px;
  color: var(--text-muted, #858585);
  line-height: 1.5;
}

.tour-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tour-nav {
  display: flex;
  gap: 8px;
}

.tour-skip {
  background: none;
  border: none;
  color: var(--text-muted, #858585);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 0;
  text-decoration: underline;
}

.tour-skip:hover {
  color: var(--text, #cccccc);
}

.tour-btn {
  padding: 6px 16px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s;
}

.tour-btn-primary {
  background: var(--accent, #0ea5e9);
  color: #fff;
  border-color: var(--accent, #0ea5e9);
}

.tour-btn-primary:hover {
  opacity: 0.85;
}

.tour-btn-secondary {
  background: transparent;
  color: var(--text, #cccccc);
  border-color: var(--border, #3c3c3c);
}

.tour-btn-secondary:hover {
  background: var(--bg-hover, #2a2d2e);
}
</style>
