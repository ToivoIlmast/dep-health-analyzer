# Changelog

All notable changes to this project are documented in this file, reconstructed
from release history where a version predates this file.

## [0.11.0] - 2026-09-17

### ⚠️ Semantic change: `Cycles detected` now counts real strongly-connected components, not naive DFS cycles

`Cycles detected` (the CLI line, its exit code, and the number everything else in
the report agrees with) is now computed from the same strongly-connected-components
analysis (`findSCCs`, Kosaraju's algorithm) used everywhere else in the report -
the Findings list, the HTML graph, and "Largest SCC". Previously it came from a
separate, naive DFS cycle enumerator (`detectCycles`) that could both undercount
and disagree with the rest of the report on the same scan.

**Concretely:** on a project shaped like `A→B→C→A` plus `A→D→A` (two cycles
sharing node `A`), the count changes from `2` to `1` - because that shape is
genuinely one 4-node strongly-connected component, not two separate cycles. The
new count of `1` is the correct one; it is also the one already consistent with
`Largest SCC: 4`, which never agreed with the old count of `2`.

**If you upgrade from 0.10.x and see a different `Cycles detected` number on a
project you haven't changed, this is why.** Your project's dependency structure
did not change - the counting method did, and the new count is the accurate one.
If `failOn` gates your CI on this number, re-check your pipeline after upgrading.

### Added
- HTML report for `cycles`: a rebuilt Findings/Graph view with a findings-first
  overview, a concrete-cycle view, "Focus SCC" (a bounded, readable view into one
  strongly-connected component without leaving the full graph), and localization
  across 14 languages.
- A project-specific `exclude` config option: glob patterns to skip paths beyond
  the built-in ignore list (`node_modules`, `dist`, `build`, test files, etc.),
  applied consistently across `cycles`, `regression`, and `history`.
- A large-scale validation corpus for exercising `cycles`/`regression`/`history`
  at scale, alongside the existing smaller fixture corpus.

## [0.10.2] - 2026-09-07

Five small, independently-scoped fixes from an external audit of 0.10.0/0.10.1.
None touch classification algorithms, cycle/SCC detection, or severity defaults.

### Fixed
- File discovery excluded only `.test.ts`/`.spec.ts`; `.test.tsx`, `.test.js`,
  `.test.jsx` and their `.spec.*` counterparts were scanned as ordinary source.
  Now excluded consistently across every scanned extension.
- The `history --ai` prompt described trend labels in terms the trend
  classifier doesn't actually guarantee; reworded to match what it computes.
- The AI summary banner printed the literal text `Server: undefined` when
  `features.regression.ai.host` was left unset; it now shows the real default.
- The cross-boundary finding's reasoning text asserted a boundary the tool has
  no way to confirm exists; reworded to state the classification result
  instead of an unconfirmable cause.
- Fixed a self-contradicting description of `cross-boundary` in
  `docs/CONFIGURATION.md`.

## [0.10.1] - 2026-09-07

### Fixed
- `.mts`/`.cts` files were never scanned as source (file discovery only
  matched `.js`/`.jsx`/`.ts`/`.tsx`), even though import resolution already
  supported them. A real cycle passing through a `.mts`/`.cts` file went
  completely undetected - `Cycles detected: 0`, exit code 0 - despite the
  README already documenting `.mts`/`.cts` support.

### Added
- An external validation corpus of real fixture projects, plus scripts to
  generate and validate it, to catch regressions like the one above earlier.

## [0.10.0] - 2026-09-07

### Changed
- Reworded output and configuration language project-wide to describe what
  is actually measured, not a verdict the tool cannot make:
  - `RiskLevel`/"Architectural Risk" is now `CrossBoundaryConcentration` -
    the same thresholds and computation, renamed to match what it measures
    (a share of findings, not a confirmed risk).
  - "Architectural Health Summary" is now "Findings by Relation Type".
  - `regression`/`history` no longer report a red/green
    "Architectural regression detected" verdict; they state what was found
    ("N cross-boundary findings were introduced in this change").
  - Recommendations no longer prescribe actions the tool can't actually
    justify (e.g. "Review N cross-boundary dependencies..."); they state
    findings instead.
  - `history --ai` no longer sends the AI a raw, judgement-loaded internal
    trend id (e.g. "worsening") - it now receives the same neutral label
    ("Increasing"/"Decreasing"/"Fluctuating"/"No Clear Trend") a human reader
    sees, after this was confirmed to produce a materially false claim
    ("risk increased") on a project with zero cycles.
  - The report's color scheme moved from a red-yellow-green good/bad
    gradient to a categorical palette with no implied verdict.
