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

### Current (v0.1)

- Dependency graph generation
- Circular dependency detection
- Import/export analysis
- Relative import resolution
- CLI support
- Basic tests and fixtures

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
- semantic code analysis;
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
- [x] Basic tests and fixtures

---

## v0.2 — Architecture Metrics

Module stability and coupling metrics.

### Features

- [ ] Ca (Afferent Coupling)
- [ ] Ce (Efferent Coupling)
- [ ] Instability metrics
- [ ] SDP violation detection
- [ ] Strongly connected components analysis

---

## v0.3 — Rules Engine

Architecture rules and policy system.

### Features

- [ ] YAML/JSON configuration
- [ ] Layer boundary validation
- [ ] Forbidden dependency rules
- [ ] Severity levels (warn/error)
- [ ] CI-friendly exit codes

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
- [ ] SVG/Graph visualization
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
- [ ] AI-powered recommendations
- [ ] Architecture review assistant
- [ ] Pull Request architecture analysis
- [ ] Team ownership insights
