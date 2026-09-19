## Context

See `proposal.md` for motivation. The current main spec file `openspec/specs/github-review-comments/spec.md` contains requirements from three ownership areas: GitHub Pull Request review UI, popup label/settings management, and Chrome extension packaging. OpenSpec supports multiple capabilities under `openspec/specs/<capability-path>/spec.md`; future changes can target narrower capability paths once the existing requirements are redistributed.

## Goals / Non-Goals

**Goals:**

- Preserve every existing requirement and scenario text while moving requirements to owner-focused capability files.
- Keep `github-review-comments` focused on GitHub Pull Request review comment behavior.
- Create `popup-label-management` for popup theme, label CRUD, icon rendering, and drag-and-drop ordering behavior.
- Create `extension-packaging` for manifest/Chrome UI packaging behavior such as extension icons.
- Leave product behavior, tests, source code, and documentation unchanged.

**Non-Goals:**

- Changing requirement wording beyond headings/purpose text needed for capability ownership.
- Adding or removing product behavior.
- Updating implementation code, popup UI, manifest behavior, tests, or README.

## Decisions

1. Keep existing `github-review-comments` path for GitHub review UI behavior.
   - Rationale: existing MVP docs already name this capability, and it remains the natural home for content script behavior.
   - Alternative considered: rename it to `github-review-ui`; rejected because it would add a rename on top of the split without adding value.

2. Use flat capability paths: `popup-label-management` and `extension-packaging`.
   - Rationale: the project already uses a flat spec layout with one capability path. Flat names are easy to target in future changes.
   - Alternative considered: nested paths such as `popup/label-management`; rejected as unnecessary hierarchy for a small extension.

3. Treat this as `skip_specs: true`.
   - Rationale: delta specs describe behavior changes, but this change only reorganizes main specs while preserving normative behavior.
   - Alternative considered: create artificial ADDED/REMOVED deltas to model movement; rejected because it would look like product behavior was removed and re-added.

## Risks / Trade-offs

- Requirement text could be accidentally changed during movement -> compare moved requirement blocks against the current source spec before marking tasks complete.
- Future contributors could still add popup requirements back to `github-review-comments` -> document capability ownership in each spec Purpose and keep proposal/design archived as reference.
- `openspec validate --specs --strict` could reject a new spec if Purpose text is too brief -> write explicit Purpose sections for each new capability and validate before completion.

## Migration Plan

1. Create `openspec/specs/popup-label-management/spec.md` with popup-owned requirements.
2. Create `openspec/specs/extension-packaging/spec.md` with packaging-owned requirements.
3. Remove those moved requirements from `openspec/specs/github-review-comments/spec.md`, leaving GitHub PR review UI behavior there.
4. Run OpenSpec validation and project tests to verify no runtime behavior was changed.
