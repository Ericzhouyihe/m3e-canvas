## 1. Append merge helper

- [ ] 1.1 Add `lib/merge.ts` with `appendScreens(current, draft)` that regenerates frame/group/item ids (remapping group `pos` keys), remaps incoming `action.to` / `actions[*].to` among incoming frames while passing `BACK_TARGET` and existing frame ids through, shifts all incoming frames and groups by one `(dx, dy)` so the block lands right of the current screens, and keeps the current `title`, `platform` and `frame` mode; verify with `lib/merge.test.ts` covering id collisions, internal wiring, wiring into an existing screen, and a multi-screen draft appended in order (`npm test`).
- [ ] 1.2 Make `appendScreens` reject a draft with no frames (throw the existing `"json"` error) and verify the test asserts it.

## 2. Draft request with project context

- [ ] 2.1 Extend `draftDesign` in `lib/ai.ts` with an optional `project: { doc, widths }` that, when set, prepends the whole-design description plus an `id=<frameId> name=<name>` list of existing screens and instructs the model to add only new screens (reuse the nav bar tabs, name consistently, wire new nav tabs to listed existing ids, do not re-create existing screens), keeping the replace-mode prompt byte-for-byte as today; verify with mocked-fetch tests in `lib/ai.test.ts` that the append request names existing screens and their ids and that the replace request is unchanged.

## 3. Draft flow in the editor

- [ ] 3.1 Add a **Replace project / Append screens** choice to the draft section of `ShareDialog` (`components/ShareMenu.tsx`), shown only when the project has at least one screen and defaulting to Append, and pass the mode through `onDraft`; verify the choice is hidden on an empty project and visible with screens in `next dev`.
- [ ] 3.2 Teach `startDraft`/`arrive` in `app/page.tsx` the append mode: run the draft through the same migration as a replaced document, merge with `appendScreens`, apply with `snapshot()` and `setDraftBefore(before)` without resetting widths, and leave file/share-link arrival on the replace path; verify in `next dev` that appending a screenshot replication to a multi-screen project keeps existing screens, adds the new one to the right, and that the keep/undo bar restores the previous document.
- [ ] 3.3 Add the new strings to `lib/i18n.ts` in all four languages and verify `lib/i18n.parity.test.ts` passes.

## 4. Tab wiring helper

- [ ] 4.1 Add `lib/wiring.ts` with a bar signature (`kind` + tab label/icon sequence), `barOfScreen(...)` that finds the nav bar on a screen, `tabPointingAt(...)` that reports which tab of the matching bars leads to a screen, and `wireTabToScreen(groups, frames, widths, frameId, slot)` that sets `actions[slot]` to the screen on every matching bar (keeping an existing transition, else `none`), sets `selected` on the screen's own bar, and leaves non-matching screens untouched; verify with `lib/wiring.test.ts` covering four matching screens, a screen with a different bar, a screen without a bar, and rewiring over an existing action.

## 5. Wiring control in the screen inspector

- [ ] 5.1 Add an **Opens from tab** control to `FrameInspector` (`components/Inspector.tsx`), visible when the screen carries a nav bar with tabs, listing the tabs, highlighting the one that currently points here, and showing how many screens a pick will wire; wire it through `app/page.tsx` to `wireTabToScreen` inside `snapshot()`; verify in `next dev` that duplicating a four-tab screen and picking tab 2 makes every screen's tab 2 open the duplicate in preview, the duplicate shows tab 2 selected, and one undo restores the prior wiring.
- [ ] 5.2 Add the control's strings to `lib/i18n.ts` in all four languages and verify `lib/i18n.parity.test.ts` passes.

## 6. Verification

- [ ] 6.1 Run `npm run typecheck` and `npm test` and confirm both pass with no new warnings.
- [ ] 6.2 Walk the end-to-end flow in `next dev`: start from one four-tab screen, duplicate it three times, wire tabs 2–4, append a screenshot replication as a fifth screen, then confirm in preview that every tab opens its screen and that opening a saved `.json` project still replaces the document.
