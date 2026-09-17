## 1. Split Main Specs

- [x] 1.1 Create `openspec/specs/popup-label-management/spec.md` with the existing popup theme, popup label management, and popup label reorder requirements, and verify the file has a valid Purpose and Requirements section.
- [x] 1.2 Create `openspec/specs/extension-packaging/spec.md` with the existing Chrome extension icon requirement, and verify the file has a valid Purpose and Requirements section.
- [x] 1.3 Remove the moved popup and packaging requirements from `openspec/specs/github-review-comments/spec.md`, and verify that file keeps only GitHub Pull Request review comment behavior requirements.

## 2. Validation

- [x] 2.1 Run `openspec validate --specs --strict` and verify all main specs pass.
- [x] 2.2 Run `openspec validate --changes split-spec-capabilities --strict` and verify the no-spec-delta change passes with `skip_specs: true`.
- [x] 2.3 Run `npm test` and verify all runtime tests still pass.
