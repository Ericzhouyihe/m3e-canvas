## Purpose

Governs how an AI-drafted design (idea sketch or screenshot replication) lands in the project: replacing the whole document or merging its screens into the current one.

## ADDED Requirements

### Requirement: Draft application offers replace or append
When an AI draft is ready to apply, the author SHALL be able to choose between replacing the whole project with the draft and appending the draft's screens to the current project. Dismissing the draft SHALL leave the current project unchanged.

#### Scenario: Append a replicated screen
- **WHEN** the author applies a draft with "append screens"
- **THEN** the current document keeps its title, screens and parts, and the draft's screens appear as new screens to the right of the existing ones with their content in place

#### Scenario: Replace keeps today's behavior
- **WHEN** the author applies a draft with "replace project"
- **THEN** the project becomes exactly the drafted document, as drafts have always applied

#### Scenario: Multi-screen draft appends every screen
- **WHEN** a draft contains several screens and the author appends it
- **THEN** each drafted screen is added as its own new screen, in order

### Requirement: Append leaves existing screens untouched
An append SHALL NOT modify the current project's parts: incoming frames, groups and items SHALL receive fresh identifiers, and existing items' identifiers, tap actions and geometry SHALL be unchanged. The document title and platform SHALL remain the current ones.

#### Scenario: Colliding ids in a draft
- **WHEN** a draft contains identifiers that also exist in the current project
- **THEN** the merged document keeps every existing part addressable and the draft's parts use the regenerated identifiers

#### Scenario: Existing wiring survives an append
- **WHEN** screens in the current project navigate to each other through tap actions
- **THEN** those actions still resolve to the same screens after the append

### Requirement: Append drafts are generated with project context
When the author drafts into the current project (append mode), the AI request SHALL describe the existing project's screens and SHALL instruct the model to add screen(s) to that project — for a replication, rebuilding the pictured screen(s) consistent with the existing screens' naming and tab bars — rather than designing from scratch. Replace mode SHALL send the request as it does today.

#### Scenario: Replicating one more tab page
- **WHEN** the author appends a screenshot replication to a project whose bottom nav has four tabs
- **THEN** the drafted screen carries names and labels consistent with the existing screens and includes a matching bottom nav, and the request names the existing screens
