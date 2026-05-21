import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface TerminalSession {
  uid: number;
  ptyId: number | null;
  label: string;
  customLabel: string | null;
  cwd?: string;
}

const MAX_LABEL_LEN = 30;

export const useTerminalStore = defineStore("terminal", () => {
  const sessions = ref<TerminalSession[]>([]);
  const activeUid = ref<number | null>(null);
  let nextUid = 1;
  let nextDefaultNum = 1;

  const activeSession = computed(
    () => sessions.value.find((s) => s.uid === activeUid.value) ?? null
  );

  function displayLabel(s: TerminalSession): string {
    return (s.customLabel ?? s.label).slice(0, MAX_LABEL_LEN);
  }

  function createSession(cwd?: string): TerminalSession {
    const uid = nextUid++;
    const label = `Terminal ${nextDefaultNum++}`;
    const session: TerminalSession = {
      uid,
      ptyId: null,
      label,
      customLabel: null,
      cwd,
    };
    sessions.value.push(session);
    activeUid.value = uid;
    return session;
  }

  function ensureFirst() {
    if (sessions.value.length === 0) createSession();
  }

  function setPtyId(uid: number, ptyId: number) {
    const s = sessions.value.find((x) => x.uid === uid);
    if (s) s.ptyId = ptyId;
  }

  function closeSession(uid: number) {
    const idx = sessions.value.findIndex((s) => s.uid === uid);
    if (idx === -1) return;
    sessions.value.splice(idx, 1);
    if (activeUid.value === uid) {
      const next = sessions.value[idx] ?? sessions.value[idx - 1] ?? null;
      activeUid.value = next ? next.uid : null;
    }
  }

  function switchTo(uid: number) {
    if (sessions.value.some((s) => s.uid === uid)) activeUid.value = uid;
  }

  function rename(uid: number, name: string) {
    const s = sessions.value.find((x) => x.uid === uid);
    if (!s) return;
    const trimmed = name.trim().slice(0, MAX_LABEL_LEN);
    s.customLabel = trimmed || null;
  }

  function getPtyIds(): number[] {
    return sessions.value
      .map((s) => s.ptyId)
      .filter((id): id is number => id !== null);
  }

  return {
    sessions,
    activeUid,
    activeSession,
    displayLabel,
    createSession,
    ensureFirst,
    setPtyId,
    closeSession,
    switchTo,
    rename,
    getPtyIds,
  };
});
