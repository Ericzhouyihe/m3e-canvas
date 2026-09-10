## Purpose

Covers duplicating a screen and wiring the duplicate in as a tab destination across every screen that shares the nav bar.

## ADDED Requirements

### Requirement: Duplicating a screen copies content and selects the copy
Duplicating a screen SHALL create a new screen to the right of the existing ones holding a copy of the source screen's parts, and SHALL select the copy for editing.

#### Scenario: Duplicate a four-tab screen
- **WHEN** the author duplicates a screen whose bottom nav has four tabs
- **THEN** a new screen appears to the right with the same parts, including the bottom nav, and becomes the selected screen

### Requirement: One-step tab wiring for a duplicate
The author SHALL be able to make the duplicate a tab destination in one step: picking a tab slot of its nav bar SHALL set that tab's action to the duplicate on every screen whose nav bar carries the same tab set, including the duplicate itself, and SHALL mark the tab as the selected one on the duplicate. Screens whose nav bar differs SHALL be untouched. The wiring SHALL participate in the existing undo history.

#### Scenario: Wire the duplicate as the second tab
- **WHEN** the author duplicates a four-tab screen and wires tab 2 to the duplicate
- **THEN** every screen sharing that four-tab nav navigates tab 2 to the duplicate, and the duplicate's nav shows tab 2 as selected

#### Scenario: Screens with a different nav stay as they are
- **WHEN** some screens in the project carry a nav bar with a different tab set, or no nav bar at all
- **THEN** the wiring leaves those screens unchanged

#### Scenario: Rewiring over an existing action
- **WHEN** the wired tab slot already navigates elsewhere on some of the matching screens
- **THEN** the one-step wiring replaces those actions on all matching screens, and undo restores the previous wiring
