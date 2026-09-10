## Context

See proposal.md for motivation. Facts that shape the approach:

- An AI draft arrives through `startDraft` → `draftDesign` → `arrive(next)` → `importDoc(next)`, which replaces the whole document and parks the previous one in `draftBefore` for the keep/undo bar (`app/page.tsx:2129-2220`). Opening files and share links go through the same `arrive`/`importDoc` and must keep replacing.
- The draft is triggered from the share dialog (`ShareDialog` → `onDraft(idea, images)`), so the mode has to be chosen there, before the request is sent — the append prompt needs project context that a post-hoc choice could not supply.
- A group belongs to a screen by geometry: `frameOfGroup(group, frames, widths)` looks at where the group sits, not at an id. Shifting a draft's frames and groups by one common offset therefore keeps its screen ownership intact.
- `duplicateFrame` (`app/page.tsx:2553`) already regenerates group/item ids with an id map; tap actions on the copy keep pointing at their original targets, which is exactly what a tab set wants.
- Nav bars (`bottomNav`, `navRail`, `toolbar`) expose one tap slot per tab, keyed `tab:N` (`iconSlotsOf`, `lib/tokens.ts:1920`); an item's `selected` is the highlighted tab index. Preview already highlights the tapped tab on the screen it opens.
- `buildPrompt` describes the whole design for the model but names screens without their ids, so a model cannot target existing screens from that text alone.
- `lib/ai.test.ts` already covers the AI request boundary with a mocked `fetch`; prompt content is testable there.

## Goals / Non-Goals

**Goals:**
- Append is a pure, unit-tested merge over `Doc` shapes; the page only wires it into the existing draft flow.
- Both features reuse the existing undo (`snapshot`) and the draft keep/undo bar unchanged.
- No project-file format change: `Doc` stays as it is.

**Non-Goals:**
- Replacing or editing a single existing screen from a screenshot ("redo this screen") — separate change.
- Wiring help for tab rows (`kind: "tabs"`) or FAB menus; only the three nav bars are covered.
- Deduplicating screens if the model ignores the instruction and returns the existing ones again — undo covers it.
- Mobile editor: the phone editor has no keep/undo bar and no draft trigger; nothing changes there.

## Decisions

### D1. The mode is chosen when the draft is started, not when it lands
The share dialog's draft section gets a two-way choice, **Replace project** / **Append screens**, shown only when the project already has at least one screen. With screens present the default is **Append**, because that is the situation the proposal describes (an author extending a tabbed app); an empty project has nothing to append to and drafts as today.

*Alternative — choose at apply time with a "keep as new screens" button next to keep/undo:* rejected. The draft would already have replaced the canvas, and the request could not have carried project context, so the model would redesign the app instead of adding to it.

### D2. Append merges with a pure helper, `appendScreens(current, draft)`
A new `lib/merge.ts` exports `appendScreens(current: Doc, draft: Doc): Doc`:
1. Fresh ids for every incoming frame, group and item (same id-map pattern as `duplicateFrame`; group `pos` keys remapped too).
2. Incoming `action.to` / `actions[*].to` that name an incoming frame are remapped to the fresh frame id; `BACK_TARGET` and ids of *existing* frames pass through unchanged so a drafted screen can navigate back into the project (see D3).
3. All incoming frames and groups shift by one `(dx, dy)`: `dx` puts the leftmost incoming frame at the current `nextFrameX()`, `dy` aligns the topmost incoming frame with the existing screens' row. Internal layout is untouched, so geometric ownership is preserved.
4. `title`, `platform` and `frame` mode stay the current document's.
A draft with no frames is rejected with the existing "json" error toast — there is nothing to append.

The page runs the incoming draft through the same migration path a replaced document gets (`migrateGroups`) *before* merging, then applies the merged document with `snapshot()` + `setDraftBefore(before)`, so the keep/undo bar and whole-document undo behave exactly as for a replace. `setWidths({})` is **not** called on append: existing measurements stay, incoming items get measured on first render like any newly added part.

*Alternative — ask the model for the full updated document and diff it:* rejected; fragile, token-hungry, and lets the model alter existing screens.

### D3. Append mode adds project context to the draft request
`draftDesign` gains an optional `project?: { doc: Doc; widths: Record<string, number> }`. When set, the user message becomes:
- an "existing project" block: the whole-design description already produced by `buildPrompt(doc, widths, undefined, lang)`, plus a compact list of `id=<frameId> name=<screen name>` for each existing screen (the description alone has no ids);
- an instruction to **add** screen(s) to that project and reply with a document containing **only the new screens**, reusing the existing nav bar's tabs and labels, naming screens consistently, wiring a new screen's nav tabs to the listed existing screen ids where they match, and not re-creating existing screens;
- for screenshots, the existing "one screen per screenshot, keep the text as pictured" wording; for an idea, "one screen unless the idea clearly needs more".
Replace mode sends the request unchanged. Response validation stays `isProject`.

### D4. One-step tab wiring lives in the screen inspector
`FrameInspector` gets an **Opens from tab** control, visible when the selected screen carries a nav bar with tabs. It lists that bar's tabs, shows which tab currently points at this screen (derived from the matching bars), and picking a tab calls a pure helper `wireTabToScreen(groups, frames, widths, frameId, slot)` in `lib/wiring.ts` that, for every screen whose bar **matches** the selected screen's bar (same `kind`, same tab sequence by label and icon), sets `actions[slot] = { to: frameId, transition }` — keeping the slot's existing transition where one is set, otherwise `none`, since a nav switch is not a push — and sets `selected = N` on the selected screen's own bar. Screens with no matching bar are left alone. The control's label shows how many screens it will touch, so a silently skipped screen (a bar whose tabs drifted) is noticeable. The page wraps the call in `snapshot()`.

*Alternative — an "apply to all screens" button in the nav item's Tap-to section:* rejected for this change; it needs the author to find and select the small bar, while the flow in the proposal is "I just duplicated a screen, make it reachable". The helper is generic enough to back such a button later.

### D5. Matching bars by tab signature, not by id
Bars are copied with fresh ids, so identity has to come from content: `kind` + `tabs.map(t => [t.label, t.icon])`. This is the same notion of "the same nav bar" an author has.

## Risks / Trade-offs

- [Model returns the whole app in append mode] → the prompt says "only the new screens" explicitly; undo restores the previous document in one step.
- [Incoming screens land at odd positions if the model placed groups outside its frames] → identical outcome to a replace today; the shift preserves whatever layout the model produced.
- [Append to a blank-canvas project (`frame === "blank"`)] → append requires screens; the choice is hidden when the project has none, and a blank project with no frames drafts as today (replace).
- [Wiring skips a screen whose bar drifted] → the control shows the number of screens it will wire; the author can fix the bar and pick again.
- [Rewiring overwrites hand-made tab actions on matching screens] → covered by undo; the control states it applies to all matching screens.
- [Prompt grows with the project] → `buildPrompt` output is already sent for behavior/description proposals; the 12k completion cap concerns the reply, which is smaller in append mode.

## Migration Plan

Purely additive UI and library code; no document format change, no data migration. Rollback is reverting the change.
