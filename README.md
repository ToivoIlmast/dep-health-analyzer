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

- [x] Extended tests and fixtures

---

## v0.3 — Rules Engine

Architecture rules and dependency policy validation.

### Features

- [ ] YAML / JSON configuration
- [ ] Layer boundary validation
- [ ] Forbidden dependency rules
- [ ] Severity levels (warn / error)
- [ ] CI-friendly exit codes
- [ ] Stable Dependencies Principle (SDP) validation

### Example

```yaml
rules:
    no-cycle: error
    no-domain-to-infra: error
```

### Quality

- [ ] Extended tests and fixtures

## Future Directions

Possible future areas of development:

- advanced architecture visualization;
- CI/CD integration;
- JSON and Mermaid export;
- historical dependency analysis;
- architectural hotspot detection;
- dependency heatmaps;
- multi-language support;
- semantic architecture analysis.
