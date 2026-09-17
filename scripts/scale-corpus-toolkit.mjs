// Shared root/helpers specific to the large-scale corpus
// (test-projects-scale/) - see test-projects-scale/README.md for why this
// corpus is a sibling of test-projects/ rather than living inside it, and
// scripts/test-projects-toolkit.mjs (imported by every scripts/gen-scale-*.mjs
// script alongside this file) for the actual file-writing/git-commit
// machinery, which this corpus reuses unchanged - this file only adds the
// one thing that's genuinely specific to being a SEPARATE root directory.
import path from 'node:path';

export const SCALE_ROOT = path.resolve(process.cwd(), 'test-projects-scale');
