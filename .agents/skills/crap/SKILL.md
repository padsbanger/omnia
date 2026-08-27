---
name: crap
description: Analyze and reduce Change Risk Anti-Pattern (CRAP) scores in TypeScript code by combining cyclomatic complexity with function-level test coverage. Use during implementation, refactoring, code review, CI quality-gate work, or when asked to identify risky, complex, under-tested functions. Prefer @barney-media/crap-typescript for TypeScript/TSX projects and integrate it with the existing lint, typecheck, test, coverage, and build pipeline.
compatibility: Requires Node.js and a TypeScript project. Works best with Vitest or Jest and Istanbul-compatible coverage. Git is required for changed-file analysis.
metadata:
  version: "2.0"
---

# CRAP — Change Risk Anti-Pattern

Use the CRAP metric to find code that is simultaneously difficult to reason about and insufficiently protected by tests.

Do not optimize the metric mechanically. The goal is safer, simpler code with useful tests.

## Metric

For a function `m`:

```text
CRAP(m) = CC(m)^2 * (1 - coverage(m))^3 + CC(m)
```

Where:

- `CC` is cyclomatic complexity.
- `coverage` is a fraction from `0` to `1`.
- Higher complexity increases risk rapidly when coverage is low.
- At full coverage, CRAP approaches the function's cyclomatic complexity, so tests do not excuse excessive complexity.

## TypeScript Tooling

For TypeScript and TSX projects, prefer:

```text
@barney-media/crap-typescript
```

Install it as a development dependency using the repository's package manager.

```bash
npm install --save-dev @barney-media/crap-typescript
```

Equivalent commands are acceptable for pnpm, yarn, or bun.

Why this package:

- analyzes TypeScript/TSX functions;
- combines cyclomatic complexity with function-level Istanbul coverage;
- supports Vitest and Jest;
- can generate/reuse `coverage/coverage-final.json`;
- supports monorepos and nested `src/` directories;
- supports `--changed` for pull-request/local-change analysis;
- provides agent-oriented output with `--agent`;
- can emit JSON and JUnit reports;
- returns a non-zero quality-gate exit code when the threshold is exceeded;
- excludes tests, declarations, build output, coverage output, node_modules, and common generated sources by default.

Do not introduce a different CRAP implementation unless the existing repository already uses one or `@barney-media/crap-typescript` is incompatible with the project.

## Threshold Policy

Use these defaults unless the repository defines stricter rules:

```text
Target during implementation: 6
Initial CI hard gate:          8
Long-term CI hard gate:        6
Traditional hotspot signal:   30+
```

Interpretation:

- `<= 6`: preferred target.
- `6–8`: acceptable temporarily, but inspect the function.
- `> 8`: fail the default CI quality gate.
- `>= 30`: severe hotspot; refactoring and/or meaningful tests are normally required.

Do not lower a score by adding meaningless tests or excluding legitimate source files.

## Activation Workflow

When this skill is activated, follow this sequence.

### 1. Inspect the repository

Determine:

- package manager from lockfiles / `packageManager`;
- test runner: Vitest, Jest, or another Istanbul-compatible runner;
- existing coverage configuration;
- current quality scripts in `package.json`;
- CI provider and workflow files;
- source layout, including monorepo packages;
- whether `@barney-media/crap-typescript` is already installed.

Preserve existing conventions. Do not replace a working test or coverage setup unnecessarily.

### 2. Ensure coverage exists

The analyzer can generate coverage itself, but in CI prefer generating coverage once and reusing it.

For Vitest, ensure coverage produces Istanbul JSON (`coverage/coverage-final.json`). A typical configuration is:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      reporter: ["text", "json"],
    },
  },
});
```

If the project already has working coverage configuration, modify it only when the CRAP analyzer cannot consume the current output.

For Jest, ensure coverage is enabled and `json` is among the reporters when required by the existing configuration.

### 3. Add package scripts

Prefer scripts similar to these:

```json
{
  "scripts": {
    "crap": "crap-typescript --threshold 8",
    "crap:changed": "crap-typescript --changed --threshold 8",
    "crap:agent": "crap-typescript --agent --threshold 8",
    "crap:report": "crap-typescript --format json --output reports/crap.json --junit-report reports/crap-junit.xml --threshold 8"
  }
}
```

Do not overwrite existing script names without checking their purpose.

If the repository uses a package-manager-specific convention, use that convention consistently.

### 4. Integrate with the quality pipeline

Preferred pipeline ordering:

```text
install
  -> lint
  -> typecheck
  -> test + coverage
  -> CRAP gate
  -> build
```

The CRAP gate belongs after coverage because the metric depends on test coverage.

Do not run the test suite twice when `coverage/coverage-final.json` has already been generated during the same pipeline.

A useful aggregate script is:

```json
{
  "scripts": {
    "quality": "npm run lint && npm run typecheck && npm run test:coverage && npm run crap"
  }
}
```

Adapt `npm` to the project's package manager instead of blindly copying this command.

### 5. CI behavior

For pull requests, prefer analyzing changed code when appropriate:

```bash
npx crap-typescript --changed --threshold 8 --agent
```

For protected/main branch verification, prefer a full scan:

```bash
npx crap-typescript --threshold 8 --agent \
  --junit-report reports/crap-junit.xml
```

If CI supports test-report artifacts, publish `reports/crap-junit.xml`.

If the pipeline already runs coverage, run CRAP after that step so the analyzer can reuse `coverage/coverage-final.json`.

Treat exit codes as follows:

```text
0 = quality gate passed
1 = analyzer/configuration/runtime error
2 = CRAP threshold exceeded
```

Do not mask exit code `2` with `|| true` in a required quality gate.

## GitHub Actions Example

When the repository uses GitHub Actions, a typical job fragment is:

```yaml
- name: Install dependencies
  run: npm ci

- name: Lint
  run: npm run lint

- name: Typecheck
  run: npm run typecheck

- name: Test with coverage
  run: npm run test:coverage

- name: CRAP quality gate
  run: npx crap-typescript --threshold 8 --agent --junit-report reports/crap-junit.xml

- name: Build
  run: npm run build
```

Use the actual package manager and scripts present in the repository.

For PR-only changed-file analysis, use:

```yaml
- name: CRAP changed-code gate
  run: npx crap-typescript --changed --threshold 8 --agent
```

Do not assume `--changed` is sufficient for the main branch. Full branch verification should periodically analyze the entire source tree.

## Optional Vitest Adapter

If tight Vitest integration is preferable, use:

```bash
npm install --save-dev \
  @barney-media/crap-typescript \
  @barney-media/crap-typescript-vitest
```

Then wrap the Vitest config:

```ts
import { withCrapTypescriptVitest } from "@barney-media/crap-typescript-vitest";

export default withCrapTypescriptVitest({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

Use the standalone CLI instead when the project benefits from keeping test execution and quality gating as explicit pipeline stages.

## Analysis Procedure

Run an agent-friendly report first:

```bash
npx crap-typescript --agent --threshold 8
```

For local work focused on the current change:

```bash
npx crap-typescript --changed --agent --threshold 8
```

For machine-readable analysis:

```bash
npx crap-typescript \
  --format json \
  --output reports/crap.json \
  --threshold 8
```

Inspect offenders from highest CRAP score downward.

For each failing or suspicious function, determine which of these is the actual problem:

1. excessive decision complexity;
2. insufficient meaningful test coverage;
3. both;
4. inaccurate/unavailable coverage attribution;
5. generated/vendor code that should legitimately be excluded.

## Refactoring Strategy

Prefer improving production design before adding tests solely to satisfy the metric.

When complexity is the problem, consider:

- extract function;
- replace nested conditionals with guard clauses;
- split parsing, validation, transformation, and side effects;
- replace boolean-flag combinations with explicit domain states;
- replace large `switch`/`if` trees with lookup tables, strategies, or polymorphism when appropriate;
- isolate I/O from pure decision logic;
- reduce duplicated branching;
- simplify conditions by naming predicates;
- separate orchestration from computation.

Do not split a cohesive function into meaningless one-line wrappers merely to reduce cyclomatic complexity.

## Testing Strategy

When coverage is the problem:

- test observable behavior, not implementation details;
- cover meaningful branches and edge cases;
- prioritize failure paths and boundary conditions;
- add focused unit tests to pure decision logic;
- use integration tests where the risk comes from component interaction;
- avoid snapshot-only coverage when assertions do not validate behavior.

A test that executes a branch without verifying its behavior is not considered a meaningful fix.

## Change-Scope Rule

When implementing a feature or fixing a bug:

1. run the CRAP report before or early in the change when practical;
2. identify functions touched by the change;
3. avoid increasing their CRAP scores;
4. if a touched function is already above the CI threshold, improve it when reasonably within scope;
5. never worsen a high-risk hotspot merely because it was pre-existing;
6. run the report again after implementation.

Prefer leaving touched code safer than it was before.

## Review Rule

During code review, flag a change when it:

- creates a new function above the configured CRAP threshold;
- materially raises CRAP on an existing function;
- adds branching without corresponding tests;
- adds tests that inflate coverage without meaningful assertions;
- suppresses or excludes source files merely to pass the gate;
- duplicates complex conditional logic instead of extracting a shared policy.

## Generated Code

Generated files should normally not participate in the quality gate.

Use the tool's default generated-code exclusions first. Add explicit exclusions only for demonstrably generated/vendor sources.

Never exclude ordinary application code simply because it fails the CRAP threshold.

## Monorepos

For monorepos, first determine whether coverage is emitted at the workspace root or per package.

Prefer explicit package/directory analysis when it improves determinism:

```bash
npx crap-typescript packages/api packages/web --threshold 8 --agent
```

Preserve the repository's workspace command conventions (`npm`, `pnpm`, `yarn`, or `bun`).

Do not assume one root coverage file correctly represents every workspace; verify coverage attribution.

## Reporting

When asked for a CRAP review, report the highest-risk functions first.

Use this compact structure:

```text
CRAP review

Gate: PASS | FAIL
Threshold: 8

1. path/to/file.ts:42 — functionName
   CRAP: 18.4
   CC: 9
   Coverage: 68%
   Cause: high branching + uncovered error paths
   Action: extract validation policy and add boundary/error tests

2. ...
```

Then summarize:

- gate status;
- number of violations;
- worst score;
- production refactors made/proposed;
- tests added/proposed;
- whether CRAP improved after the change.

Do not dump every clean function unless explicitly requested.

## Definition of Done

A CRAP-related change is complete when:

- existing tests pass;
- coverage generation succeeds;
- CRAP analysis succeeds;
- no new threshold violations were introduced;
- changed functions do not have unjustified CRAP regressions;
- high-risk touched functions were simplified or meaningfully tested where practical;
- lint and typecheck still pass;
- the production build still succeeds;
- CI can enforce the same CRAP gate deterministically.

## Guardrails

Never:

- game coverage metrics;
- add vacuous tests;
- weaken assertions merely to gain coverage;
- disable the gate to get a build green;
- lower the threshold without explicit justification;
- exclude legitimate application code from analysis;
- refactor stable code extensively without tests first when doing so would increase risk;
- confuse line count with cyclomatic complexity;
- claim high test coverage makes highly complex code inherently maintainable.

The metric is a decision aid, not the objective itself. Optimize for understandable code, meaningful tests, and low change risk.
