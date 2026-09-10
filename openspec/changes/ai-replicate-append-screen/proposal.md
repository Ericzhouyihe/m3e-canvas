# AI drafts can append screens instead of replacing the project

## Why

Applying an AI draft (idea sketch or screenshot replication) imports a whole new document, discarding the author's existing screens — asking the AI to replicate one more tab page collapses a four-screen project back to one screen. Separately, building a tabbed app means duplicating a screen per tab and then hand-wiring every screen's bottom-nav tab action to the new screen, four edits per screen.

## What Changes

- Applying an AI draft offers a choice: **replace the project** (today's behavior) or **append the draft's screens** to the current project. Appending merges the draft's frames and groups into the current document (ids regenerated, frames placed to the right of existing ones) instead of overwriting it.
- In append mode the AI is told about the existing project (screens, names, tab bars) so replicated screens match the established naming and the existing tab set, rather than inventing a parallel design.
- Screen duplication gains wiring help: after duplicating a screen as a new tab destination, the matching `tab:N` action can be wired to the new screen on **every** screen that carries the same nav bar in one step, instead of editing each screen's nav by hand.

## Capabilities

### New Capabilities

- `ai-draft-application`: how an AI-drafted design lands in the project — replacing the whole document or merging its screens into the current one, and what the merge guarantees (ids, frame placement, title/theme ownership).
- `screen-duplication`: duplicating a screen, including one-step tab wiring for the duplicate across all screens sharing the nav bar.

### Modified Capabilities

<!-- openspec/specs/ is empty; no existing capabilities are modified. -->

## Impact

- `app/page.tsx` — `startDraft`/`arrive`/`importDoc` (apply choice + merge path), `duplicateFrame` (wiring help).
- `lib/ai.ts` — replicate/draft prompt gains project context in append mode.
- New merge helpers (id regeneration, nav action patching) likely in `lib/` alongside `tidy.ts`/`tokens.ts`, with unit tests.
- `lib/i18n.ts` — new strings for the apply choice and wiring affordance.
- Opening saved files and shared links keeps replacing the document outright; only the AI-draft path changes.
