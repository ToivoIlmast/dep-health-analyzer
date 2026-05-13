# dep-health

Architecture and dependency analysis tool for JS/TS projects.

`dep-health` helps detect architectural problems early:

- circular dependencies;
- unstable module boundaries;
- coupling issues;
- architecture decay in growing codebases.

The long-term goal is to provide practical architecture intelligence for engineering teams and large-scale applications.

---

## Features

### Current (v0.2)

- Ca/Ce metrics
- Instability metrics
- Strongly connected components analysis (SCC)

---

## Supported

- TypeScript (`.ts`, `.tsx`)
- JavaScript (`.js`, `.jsx`)

---

## Install

```bash
npm install -D dep-health
```

## Usage

```bash
npx dep-health scan ./src
```

### Example output:

```bash
Scanned files: 40
Nodes: 40
Edges: 30
Cycles: 1

a.ts -> b.ts -> c.ts -> a.ts
```

## Vision

`dep-health` is evolving from a dependency analyzer into an architecture intelligence tool focused on:

- maintainability;
- architectural boundaries;
- coupling analysis;
- structural code insights;
- CI/CD architecture validation;
- engineering insights.

# Roadmap

## v0.1 — Dependency Graph MVP

Basic project dependency analyzer.

### Features

- [x] JS/TS file discovery
- [x] Import/export extraction
- [x] Dependency graph generation
- [x] CLI support
- [x] Cycle detection

### Quality

- [x] Basic tests and fixtures

---

## v0.2 — Architecture Metrics & Visualization

Module stability analysis and architectural dependency insights.

### Features

- [x] Ca (Afferent Coupling)
- [x] Ce (Efferent Coupling)
- [x] Instability metrics
- [x] Strongly connected components analysis

### Reports & Visualization

- [ ] HTML reports
- [ ] Mermaid export
- [ ] Dependency graph visualization
- [ ] SCC cluster highlighting
- [ ] Basic visualization: HTML, Mermaid, SCC highlight

### Quality

- [ ] Tests and fixtures

### Planned

- [ ] SDP violation detection

---

## v0.3 — Rules Engine

Architecture rules and policy system.

### Features

- [ ] YAML/JSON configuration
- [ ] Layer boundary validation
- [ ] Forbidden dependency rules
- [ ] Severity levels (warn/error)
- [ ] CI-friendly exit codes

### Quality

- [ ] Tests and fixtures

Example:

```yaml
rules:
    no-cycle: error
    no-domain-to-infra: error
```

## v0.4 — Reports & Visualization

Project architecture visualization and reporting.

### Features

- [ ] HTML reports
- [ ] Mermaid export
- [ ] JSON export
- [ ] Advanced visualization: interactive graph, heatmaps, architecture explorer, onboarding mode
- [ ] Dependency heatmaps

---

## v0.5 — CI/CD Integration

Pipeline integration and automated architecture checks.

### Features

- [ ] `dep-health check`
- [ ] GitHub Actions integration
- [ ] GitLab CI integration
- [ ] Pull Request checks
- [ ] Build blocking on violations

## v0.6 — Semantic Analysis

Semantic architecture and code quality analysis.

### Features

- [ ] God Component detection
- [ ] Responsibility analysis
- [ ] Complexity analysis
- [ ] Multiple sources of truth detection
- [ ] State flow analysis
- [ ] Anti-pattern detection

---

## v0.7 — Multi-language Support

Multi-language architecture analysis support.

### Planned adapters

- [ ] Python
- [ ] Rust
- [ ] Java
- [ ] Go
- [ ] Language adapter API
- [ ] Universal dependency graph support

## v1.0 — Architecture Intelligence Platform

Full architecture analysis and engineering intelligence platform.

### Features

- [ ] Architecture score
- [ ] Trend analysis
- [ ] Blast radius analysis
- [ ] Organization-wide policies
- [ ] Architecture recommendations
- [ ] Architecture review assistant
- [ ] Pull Request architecture analysis
- [ ] Team ownership insights
