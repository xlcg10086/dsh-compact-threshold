# dsh-compact-threshold — Changelog

## 1.0.0 (2026-10-28)

- First public release.
- Composer control for the automatic context-compaction threshold (20%–80%).
- Live threshold injection into the running `BasicCompactionEngine` without restarting DSH.
- Immediate compaction when the threshold is lowered below current usage and the agent is idle.
- Current usage, context window, effective trigger line, and quick presets in the panel.
- Chinese and English UI.
