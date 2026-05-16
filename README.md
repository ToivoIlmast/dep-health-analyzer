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

Architecture metrics:

- Ca (Afferent Coupling)
- Ce (Efferent Coupling)
- Instability analysis

Dependency analysis:

- Circular dependency detection
- Strongly connected components analysis (SCC)

Visualization:

- Interactive HTML dependency graph
- SCC cluster highlighting
- Node sizing based on dependency weight
- Module tooltips with metrics
- Connected dependency highlighting

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

Run dependency analysis:

```bash
npx dep-health scan ./src
```

Generate interactive HTML report:

```bash
npx dep-health scan ./src
```

### Example output

```bash
dep-health v0.2.0

Project: ./src

Files scanned: 40
Modules: 40
Dependencies: 30

Architecture

Cycles detected: 1
Largest SCC: 4 modules

Most unstable modules

auth-api.ts        I=1.00
session-store.ts   I=0.91

Most stable modules

core.ts            I=0.05
shared-types.ts    I=0.10

Generate interactive HTML report:
dep-health-report.html
```

## Vision

`dep-health` aims to help developers understand and maintain dependency architecture in growing codebases.

The project focuses on:

- dependency visibility;
- architectural boundaries;
- coupling analysis;
- cycle detection;
- long-term maintainability.

The long-term direction is practical architecture tooling for engineering teams and large-scale applications.

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

Module stability analysis and dependency architecture visualization.

### Features

- [x] Ca (Afferent Coupling)
- [x] Ce (Efferent Coupling)
- [x] Instability metrics
- [x] Strongly connected components analysis
- [x] Circular dependency detection

### Visualization

- [x] Interactive HTML report
- [x] Dependency graph visualization
- [x] SCC cluster highlighting
- [x] Node sizing based on dependency weight
- [x] Module metrics tooltips
- [x] Connected dependency highlighting

### Quality

- [ ] Extended tests and fixtures

### Planned

- [ ] SDP violation detection

---

## v0.3 — Rules Engine

Architecture rules and dependency policy validation.

### Features

- [ ] YAML / JSON configuration
- [ ] Layer boundary validation
- [ ] Forbidden dependency rules
- [ ] Severity levels (warn / error)
- [ ] CI-friendly exit codes

### Example

```yaml
rules:
    no-cycle: error
    no-domain-to-infra: error
```

### Quality

- [ ] Tests and fixtures

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
