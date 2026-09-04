# Configuration Reference

`dep-health-analyzer` is configured through a single JSON file in your project root: `dep-health.config.json` (or `.dep-healthrc.json`, checked second if the first doesn't exist).

Generate a starting point with:

```bash
npx dep-health-analyzer --init
```

Since v0.5.0, every config file is validated against the tool's JSON Schema before it's used. An invalid config (wrong type, unknown field, invalid enum value) fails fast with a clear error pointing at the exact field — it is never silently ignored or partially applied.

```
Invalid configuration in dep-health.config.json:
  - /features/scc/mode must be equal to one of the allowed values
```

The `$schema` field at the top of a generated config gives you autocomplete and inline validation in editors that support JSON Schema (VS Code does, out of the box). It points at the schema file on GitHub rather than a local path, so it resolves the same way whether you're inside this repository or in a project that installed `dep-health-analyzer` from npm — no local file needs to exist for it to work.

---

## Top-level structure

```json
{
    "$schema": "...",
    "features": {
        "regression": { ... },
        "scc": { ... }
    }
}
```

Both `features.regression` and `features.scc` are optional — omit either one and that feature simply won't run when you invoke its command. Every field documented below is optional too; anything you don't set falls back to the tool's default.

Unknown fields anywhere in the config are rejected by the schema (`additionalProperties: false`) — this catches typos like `enabeld` instead of `enabled` immediately, instead of the field being silently ignored.

---

## `features.regression`

Controls the `regression` command — comparing the current dependency graph against a Git baseline.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Whether the `regression` command runs at all. |
| `mode` | `"full"` \| `"compact"` \| `"html"` | `"compact"` | Output format. `full` prints every finding with reasoning, `compact` prints category counts (CI-friendly), `html` writes an interactive report. |
| `failOn` | `"info"` \| `"warning"` \| `"error"` | `"warning"` | Minimum severity that causes the command to exit with code `1`. See [Severity and failOn](#severity-and-failon) below. |
| `reporting.html.enabled` | `boolean` | `true` | Whether `--mode html` is allowed to write a report. If `false`, running with `--mode html` prints a warning and skips the report instead. |
| `reporting.html.outputPath` | `string` | `"./dep-health-reports/regression.html"` | Where the HTML report is written. |
| `ai.enabled` | `boolean` | `true` | Whether `--ai` is allowed to run. The `--ai` CLI flag still has to be passed explicitly on top of this — enabling it here doesn't turn AI summaries on by default. |
| `ai.provider` | `"ollama"` | `"ollama"` | Only `ollama` is supported today (local or Ollama's cloud-hosted models — see [AI Summaries](../README.md#ai-summaries-experimental) in the README). |
| `ai.host` | `string` | `"http://localhost:11434"` | Ollama server URL. |
| `ai.model` | `string` | `"qwen3:14b"` | Model name, exactly as it appears in `ollama list`. |
| `ai.language` | `string` | `"en"` | Free-text language name passed to the model (e.g. `"en"`, `"Russian"`, `"finnish"` all work — the model interprets it, there's no fixed enum). |
| `severity.*` | see below | see below | Default severity per relation category. |
| `thresholds.*` | see below | see below | Depth thresholds used to classify new dependencies. |
| `scopes` | array | `[]` | Per-path overrides. See [Scopes](#scopes) below. |
| `history.*` | see below | see below | Controls the `history` command. See [History Analysis](#history-analysis) below. |

### Severity and `failOn`

Every finding is classified into one relation category (`internal`, `sibling`, `deep-internal`, `cross-boundary` — see [Thresholds](#thresholds) below for how), and each category has its own severity:

```json
"severity": {
    "cross-boundary": "warning",
    "deep-internal": "warning",
    "sibling": "info",
    "internal": "info"
}
```

Severity ranks as `info` (1) < `warning` (2) < `error` (3). The command exits with code `1` if **any** finding's severity is greater than or equal to `failOn`. Example: with `failOn: "warning"`, a single `sibling` (`info`) finding won't fail the build, but one `cross-boundary` (`warning`) finding will.

### Thresholds

```json
"thresholds": {
    "internalDepth": 3,
    "deepInternalResidualDepth": 3
}
```

These control how a new dependency gets classified:

- **`sibling`** — the two files live in the exact same directory. Always this, regardless of thresholds.
- **`internal`** — the files share at least `internalDepth` path segments, and the dependency doesn't reach more than 1 level deeper past that shared point.
- **`deep-internal`** — the files share at least `internalDepth` path segments, but the dependency reaches `deepInternalResidualDepth` or more levels deeper — i.e. it reaches into another module's internals instead of a shallow/public entry point.
- **`cross-boundary`** — anything that doesn't match the above. The files don't share enough of a common path to be considered "the same area".

Raising `internalDepth` makes the tool more willing to call something `cross-boundary` (harder to qualify as "internal"). Lowering `deepInternalResidualDepth` makes it more sensitive to deep internal reaches.

Note the `internal` and `deep-internal` checks are independent, not a single scale: a dependency with `commonDepth >= internalDepth` but a `residualDepth` strictly between `1` and `deepInternalResidualDepth` matches neither and falls through to `cross-boundary`, even though it does share the required common path. With the defaults (`deepInternalResidualDepth: 3`), that gap is `residualDepth` of exactly `2`. Keeping `deepInternalResidualDepth` at `2` closes that gap if you'd rather such cases count as `deep-internal`.

#### Why two separate numbers

JavaScript and TypeScript have no real "this is a private implementation detail" concept at the module level — anything a file exports is importable from anywhere. Thresholds approximate that missing concept using folder structure instead, since most projects already loosely organize files by how "public" they're meant to be (an `index.ts` near the top of a feature, implementation details nested deeper inside it).

`internalDepth` and `deepInternalResidualDepth` answer two different questions, which is why they're separate rather than one combined number:

1. **`internalDepth`** — are these two files even in the same architectural area to begin with? (Do they share enough leading path segments?)
2. **`deepInternalResidualDepth`** — given they are, how far past that shared point does the dependency reach? Shallow (near the area's likely public entry point) or deep (bypassing it, into internal implementation details)?

Keeping them independent means you can tune each without affecting the other — a deeply nested monorepo (`src/apps/x/features/y/z/...`) typically needs a *higher* `internalDepth` (more path segments are just structural boilerplate before you reach a real module boundary), while a flat `src/*` layout needs a lower one, independent of how sensitive you want deep-reach detection to be.

#### Worked example

Given `internalDepth: 3, deepInternalResidualDepth: 3` (the defaults), and a new dependency from `src/features/auth/AuthService.ts` to each of these targets:

| Target | `commonDepth` | `residualDepth` | Result | Why |
|---|---|---|---|---|
| `src/features/auth/PermissionCheck.ts` | 3 | 0 | `sibling` | Same directory as the source file — checked before thresholds even apply. |
| `src/features/auth/session/refresh.ts` | 3 | 1 | `internal` | Same area, one directory level in — still shallow. |
| `src/features/auth/internal/token/hash.ts` | 3 | 2 | `cross-boundary` | Same area (`commonDepth >= internalDepth`), but `residualDepth` (2) is in the gap described above — too deep for `internal` (`<= 1`), not deep enough for `deep-internal` (`>= 3`). |
| `src/features/auth/internal/token/utils/hash.ts` | 3 | 3 | `deep-internal` | Same area, but reaches 3 directory levels past it — past a likely public surface, into implementation details. |
| `src/core/logger.ts` | 1 | 1 | `cross-boundary` | `commonDepth` (1) is below `internalDepth` (3) — not the same area at all. |

All five rows share the same source file, `src/features/auth/AuthService.ts`, and the default thresholds (`internalDepth: 3, deepInternalResidualDepth: 3`). `commonDepth` is how many leading path segments the source and target share. `residualDepth` is how many *more* directory levels the target's path goes beyond that shared point (its own filename doesn't count). Verified against the actual classifier, not computed by hand.

### Scopes

Scopes let you override `severity`, `thresholds`, or skip findings entirely (`ignore`) for specific parts of your project, without changing the global rules for everything else.

```json
"scopes": [
    { "match": "src/app/**", "ignore": true },
    { "match": "src/features/**/visualization/**", "ignore": true },
    {
        "match": "src/features/**/ci/reporting/**",
        "severity": { "cross-boundary": "info", "deep-internal": "info" }
    },
    {
        "match": "src/features/regression/**",
        "thresholds": { "internalDepth": 2, "deepInternalResidualDepth": 2 }
    }
]
```

(This example is dep-health's own config — it's a real, working scopes setup, not a made-up one.)

- `match` is a glob pattern (same syntax as `.gitignore`-style globs, matched via `minimatch`), tested against the **source** file of each finding (the file that introduced the new dependency).
- `ignore: true` drops findings from that path entirely — they never appear in output and never affect `failOn`.
- `severity`/`thresholds` merge into the global values for matches in that scope, only overriding the keys you specify.
- If multiple scopes match the same file, they're applied in order from **least to most specific** (specificity = length of the `match` string) — so a more specific pattern's overrides win over a broader one's.

**When to use scopes:** composition roots, infrastructure/wiring code, visualization, and reporting layers are usually fine analyzed loosely (`ignore: true` or relaxed severity) — they're expected to reach across the project by design. Core domain logic is usually where you want the default (or tighter) thresholds, since unexpected cross-boundary reaches there are more likely to be real architectural drift worth reviewing.

#### The same thresholds mean different things in different projects

`internalDepth` and `deepInternalResidualDepth` are raw path-segment counts — they have no idea how deep *your* project's structure normally is. The same numbers can be meaningfully strict in one project and almost meaningless in another.

Take `internalDepth: 3` (the default) in a monorepo laid out as `apps/web/src/modules/<feature>/...`, and a new dependency from `apps/web/src/modules/billing/services/InvoiceService.ts`:

| Target | `commonDepth` | With `internalDepth: 3` | With `internalDepth: 5` |
|---|---|---|---|
| `apps/web/src/modules/auth/AuthService.ts` (a *different* module) | 4 | `internal` | `cross-boundary` |
| `apps/web/src/modules/billing/InvoiceUtils.ts` (the *same* module) | 5 | `internal` | `internal` |

With the default `internalDepth: 3`, `apps/web/src` (3 segments) alone is already enough to count as "the same area" — so a dependency from `billing` straight into a completely unrelated `auth` module gets waved through as `internal`, which defeats the point: that *is* a cross-module dependency worth a second look. Raising `internalDepth` to `5` (matching where this project's real module boundary actually sits) fixes it, without touching the `billing`-to-`billing` case at all. Verified against the real classifier, not assumed.

**Takeaway:** set `internalDepth` to the number of path segments it actually takes to reach a real module boundary *in your project* — read it off your own folder structure, don't leave the default unexamined.

#### A tuning gotcha: relaxing thresholds doesn't always relax the result

It's tempting to "calm down" noisy `deep-internal` findings from a folder that's just naturally deeply nested (a shared UI library, say) by raising `deepInternalResidualDepth`. That doesn't always do what you'd expect, because `internal` and `deep-internal` are independent checks with a gap between them (see [above](#thresholds)) — pushing `deep-internal`'s bar higher can just move a case into that gap instead of into `internal`:

```
from: src/shared/ui/components/Table/index.ts
to:   src/shared/ui/components/Table/cells/EditableCell/hooks/useCellState.ts
commonDepth: 5, residualDepth: 3

thresholds { internalDepth: 3, deepInternalResidualDepth: 3 } → deep-internal
thresholds { internalDepth: 3, deepInternalResidualDepth: 6 } → cross-boundary   (not internal!)
```

Raising `deepInternalResidualDepth` from `3` to `6` didn't quiet this finding down — it turned it into `cross-boundary`, which is the *most* visible category by default. If a folder is just structurally deep by nature and you don't want its internal reshuffling reviewed at all, reach for `severity` or `ignore` on a scope matching that folder instead of trying to out-tune the thresholds:

```json
{ "match": "src/shared/ui/**", "severity": { "deep-internal": "info", "cross-boundary": "info" } }
```

#### Excluding something from analysis entirely

Some folders aren't worth architectural review at all — generated code is the clearest case. Its internal dependency shape is produced by a codegen tool, not by a person making a design decision, so findings from it are just noise:

```json
{ "match": "src/generated/**", "ignore": true }
```

This is different from lowering severity: an `ignore`d scope's findings never appear in any report and never influence `failOn`, as if they didn't exist. Reach for `severity` when you still want visibility but lower urgency, and `ignore` when a path genuinely shouldn't be analyzed at all.

---

### History Analysis

Controls the `history` command — walking a range of Git history instead of comparing just two revisions. It reuses `features.regression`'s `thresholds`, `severity`, and `scopes` (a history walk's findings are governed by the same rules as a single-baseline regression check), and only adds a few fields of its own:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Whether the `history` command runs at all. |
| `sampleSize` | `number` (integer, >= 2) | `10` | How many commits to sample (evenly spaced) between the baseline and the current revision. Overridable per-run with `--points`. A single point can never produce a comparison (there's nothing to diff it against), so the minimum is 2, not 1. |
| `strategy` | `"incremental"` \| `"cumulative"` \| `"both"` | `"incremental"` | Which comparison to compute and report at each sampled point — see below. Overridable per-run with `--strategy`. |
| `mode` | `"full"` \| `"compact"` \| `"html"` | `"compact"` | Output format. `html` generates a trend chart — see below. |
| `reporting.html.enabled` | `boolean` | `true` | Whether `--mode html` is allowed to write a report. If `false`, running with `--mode html` prints a warning and skips the report instead. |
| `reporting.html.outputPath` | `string` | `"./dep-health-reports/history.html"` | Where the HTML report is written. |

Sampling walks the **first-parent** chain (the mainline of merge commits, not every commit on every merged branch) between the baseline and the current revision, so a history of feature branches merged via pull requests reads as one sequential timeline instead of an arbitrarily-ordered graph.

Two strategies answer different questions, and both are always computed internally — `strategy` only picks what gets displayed, so switching between `incremental`, `cumulative`, and `both` never re-walks history:

- **`incremental`** — each sampled point is compared against the *previous* sampled point. Answers "how much risk was introduced in this window of history?" A spike at one point means something worth reviewing happened specifically in that window.
- **`cumulative`** — each sampled point is compared against the *first* sampled point (the baseline). Answers "how far have we drifted from the baseline overall?" Numbers tend to grow and then plateau rather than spike, since they're a running total, not a per-window count.

Example, sampling 6 points across dep-health's own history from its root commit to a later revision:

```
Commit    Files  Incremental  Cumulative
a04ffa3   36     -            -
9fd349e   76     113          113
da75434   84     30           130
0ef022c   84     2            131
7c7a18c   87     1            132
04f7642   87     1            131
```

`incremental` tapers off quickly (113 → 30 → 2 → 1 → 1) — most of the early history was one large burst of initial growth, and later commits mostly stopped introducing new cross-boundary risk. `cumulative` grows and plateaus (113 → 130 → 131 → 132 → 131) — the total distance from the root commit stays roughly the same once growth slows down. Neither number is "wrong" — they answer different questions about the same history.

```bash
dep-health-analyzer history --baseline HEAD~50 --points 10 --strategy both --mode full
```

`--mode html` renders the same points as an interactive line chart (one line per selected strategy, with a native tooltip on every point showing the exact finding count), followed by a summary table with every sampled commit's metadata. It's a hand-rolled inline SVG chart with no external dependency, matching how the `regression` HTML report is already fully self-contained:

```bash
dep-health-analyzer history --baseline HEAD~50 --points 10 --strategy both --mode html
```

#### Trend Summary

Raw per-point numbers aren't self-interpreting — "39, 43, 0, 2, 1..." doesn't say on its own whether that's fine or worth a closer look. Every mode (`compact`, `full`, `html`) includes a **Trend Summary**, derived from the `incremental` series specifically (risk introduced per sampled window — this is what "spike" and "trend" mean below, regardless of which `strategy` you picked for display):

- **Classification** — `Stabilizing` (risk dropped by 30%+ between the first and second half of the sampled range), `Worsening` (risk rose by 30%+, or went from nothing to something), `Volatile` (no clear direction, but high relative variance), or `Stable` (quiet throughout, or too few points to say).
- **Spikes** — points where the value is both more than 2x the series' own mean *and* at least 5 findings. The dual condition avoids flagging a small number (like 3) as a "spike" just because the series mean happens to be near zero.
- **Highest risk window** — the single point with the most findings, shown even when nothing formally qualifies as a spike.

These thresholds (30% for the trend split, 2x + minimum 5 for spikes) are **not currently configurable** — like Risk Assessment's thresholds below, they're fixed in code, calibrated against dep-health's own real commit history rather than picked arbitrarily. A 19-point real series with values `[14,0,86,27,0,30,0,0,1,1,0,1,0,1,0,0,0,50,12]` (mean ~11.8) correctly flags only the four genuinely elevated windows (27, 30, 50, 86) as spikes, and classifies as `Stabilizing` overall since the second half of that range averages much lower than the first.

---

## Risk Assessment (HTML report)

The `--mode html` regression report includes a "Risk Assessment" banner (Low / Moderate / High Architectural Risk). It measures how large a share of **this change's** findings are `cross-boundary` — not how large a share of the whole project is cross-boundary. The same absolute change reads the same regardless of how big the surrounding codebase happens to be.

Below **2** cross-boundary findings, risk always stays Low, no matter the percentage. A single cross-boundary finding in a 1-3 finding change is 33-100% by percentage alone, which is just noise from a tiny denominator, not a real signal of a trend. Once there are 2 or more cross-boundary findings, the percentage of `cross-boundary` findings among all findings in the change decides the rest: above 15% is High, above 5% is Moderate, otherwise Low.

These numbers (2 minimum, 5%/15% bands) are **not currently configurable** — unlike `thresholds` and `severity` above, they're fixed in code. They were checked against dep-health's own commit history before being set, not picked arbitrarily:

| Change | Cross-boundary | Total findings | Result | Why |
|---|---|---|---|---|
| 1 cross-boundary out of 1 finding | 1 | 1 | Low | Below the minimum of 2 — a single finding shouldn't decide "High" on its own. |
| 1 cross-boundary out of 3 findings | 1 | 3 | Low | Same — 33% looks alarming, but it's one data point. |
| 4 cross-boundary out of 26 findings | 4 | 26 | High | At or above the minimum; 15.4% crosses the High threshold. |
| 9 cross-boundary out of 20 findings | 9 | 20 | High | 45% — a real, repeated signal, not noise. |

The first two rows are real dep-health commits that used to read "High Architectural Risk" under an earlier, unqualified percentage — a real change with one incidental cross-boundary finding shouldn't top the risk scale the same way a change with many does.

---

## `features.scc`

Controls the `cycles` command — dependency cycle / SCC detection.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Whether the `cycles` command runs at all. |
| `mode` | `"full"` \| `"compact"` \| `"html"` | `"compact"` | Same meaning as `regression.mode`. |
| `failOn` | `"info"` \| `"warning"` \| `"error"` | `"error"` | The command exits with code `1` if any cycle is detected and `failOn` isn't `"info"`. |
| `reporting.html.enabled` | `boolean` | `true` | Same meaning as `regression.reporting.html.enabled`. |
| `reporting.html.outputPath` | `string` | `"./dep-health-reports/scc.html"` | Where the HTML report is written. |

> `severity` and `maxSize` are accepted by the schema and can be set without a validation error, but nothing in the current implementation reads them — they don't yet affect behavior. Documented here for accuracy rather than left silently undocumented; treat them as reserved for now, not as working options.

---

## Full example

```json
{
    "$schema": "https://raw.githubusercontent.com/ToivoIlmast/dep-health-analyzer/master/src/app/config/config.schema.json",
    "features": {
        "regression": {
            "enabled": true,
            "mode": "compact",
            "failOn": "warning",
            "reporting": {
                "html": { "enabled": true, "outputPath": "./dep-health-reports/regression.html" }
            },
            "severity": {
                "cross-boundary": "warning",
                "deep-internal": "warning",
                "sibling": "info",
                "internal": "info"
            },
            "thresholds": { "internalDepth": 3, "deepInternalResidualDepth": 3 },
            "scopes": [
                { "match": "src/app/**", "ignore": true },
                {
                    "match": "src/features/regression/**",
                    "thresholds": { "internalDepth": 2, "deepInternalResidualDepth": 2 }
                }
            ],
            "ai": {
                "enabled": true,
                "provider": "ollama",
                "host": "http://localhost:11434",
                "model": "qwen3:14b",
                "language": "en"
            },
            "history": {
                "enabled": true,
                "sampleSize": 10,
                "strategy": "incremental",
                "mode": "compact",
                "reporting": {
                    "html": { "enabled": true, "outputPath": "./dep-health-reports/history.html" }
                }
            }
        },
        "scc": {
            "enabled": true,
            "mode": "compact",
            "failOn": "error",
            "reporting": { "html": { "enabled": true, "outputPath": "./dep-health-reports/scc.html" } }
        }
    }
}
```
