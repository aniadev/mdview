const AGENT_FILES = new Set(["CLAUDE.md", "AGENTS.md", ".cursorrules"]);

const AGENT_PATTERNS = [
  /\.cursor\/rules\/.*\.md$/,
  /\.github\/copilot-instructions\.md$/,
];

export function isAgentFile(filename: string): boolean {
  if (AGENT_FILES.has(filename)) return true;
  return AGENT_PATTERNS.some((p) => p.test(filename));
}
