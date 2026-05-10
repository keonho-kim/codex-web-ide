# Design System: Codex Web IDE

## 1. Visual Theme & Atmosphere

Codex Web IDE should feel like a quiet local development notebook: functional, low-glare, and paper-like without becoming decorative. The interface uses cool light-gray paper tones instead of pure white, with subtle surface steps to separate the project rail, workbench, editor, chat, and control panels.

The target atmosphere is closer to an e-book reader or matte e-ink display than a SaaS dashboard. Backgrounds should recede, controls should remain calm, and color should act as punctuation for state, selection, and action. Avoid bright white expanses, yellowed parchment casts, glossy cards, strong shadows, saturated gradients, and visible texture patterns.

Texture is allowed only as a barely perceptible paper or concrete grain. It should soften large flat surfaces without drawing attention to itself. If a user notices the texture as a pattern, it is too strong.

Research basis: Carbon Design System's Gray 10 theme uses `#f4f4f4` as a primary light background and alternates white/gray layers; neutral design-system guidance recommends at least six distinct neutral roles across background, surface, border, disabled, secondary text, and primary text; e-ink displays are perceived through constrained gray steps rather than bright white panels. Codex Web IDE should therefore use deliberate cool-gray layering rather than warm beige neutrals.

## 2. Color Palette & Roles

- **Concrete Page Gray (#eceeee):** App page background. Used behind all panels to reduce glare and remove the previous yellow cast.
- **E-ink Canvas (#f7f8f7):** Primary work surfaces such as the workbench, editor, chat, and dialogs. This replaces pure white for large areas.
- **Cool Paper Panel (#f1f3f2):** Secondary surfaces such as sidebars, toolbar strips, and nested panels.
- **Pressed Concrete (#e5eaeb):** Hover and low-emphasis accent surface for controls and row highlights.
- **Cool Hairline (#d6dcdd):** Fine dividers and panel outlines. Borders should be visible but never high contrast.
- **Control Graphite Stroke (#bec8ca):** Inputs and stronger interactive outlines.
- **Reading Ink (#202627):** Primary text. Never use absolute black for normal UI text.
- **Muted Slate (#687174):** Secondary text, timestamps, empty states, and subdued metadata.
- **Desaturated Teal Action (#466a76):** Primary actions, focused inputs, active icons, and main links.
- **Mist Blue Selection (#dce8eb):** Active tab, selected thread, and selected list item backgrounds.
- **Mist Blue Border (#91aab1):** Selected item border and resize-handle hover.
- **Graphite Violet (#626b85):** Codex-specific status and assistant activity accents.
- **Graphite Violet Soft (#e7eaf0):** Codex header and Codex-specific soft containers.
- **Quiet Success (#4f7464) / Soft Success (#e2ebe7):** Healthy services and completed states.
- **Muted Umber (#7b6a42) / Soft Umber (#ede7d8):** Warning states and running job indicators.
- **Muted Red (#b24b45):** Destructive actions and errors.

## 3. Typography Rules

Use the existing sans-serif UI stack for dense development workflows. Keep letter spacing at zero for UI text and avoid oversized marketing-style type. Headings should be small, clear, and utilitarian; metadata can be compact but must remain readable against the cool gray surfaces.

Code, file paths, commands, and repository paths should continue using the monospace stack. Text contrast should be evaluated against the new soft-paper surfaces, not against pure white.

## 4. Component Stylings

- **Panels and Work Surfaces:** Use E-ink Canvas or Cool Paper Panel backgrounds with Cool Hairline borders. Prefer flat separation over shadows.
- **Sidebars and Toolbars:** Use Cool Paper Panel to sit one tone darker than the main editor canvas.
- **Buttons:** Primary buttons use Desaturated Teal Action with e-ink foreground. Ghost and outline buttons should reveal Pressed Concrete on hover.
- **Tabs and Selected Rows:** Use Mist Blue Selection with Mist Blue Border for selection. Avoid saturated blue fills.
- **Inputs and Dialogs:** Inputs use E-ink Canvas with Control Graphite Stroke. Dialogs use the same cool paper palette as the app, not pure white.
- **Status Chips:** Use quiet semantic soft fills. Do not introduce bright green, yellow, or red surfaces.
- **Texture:** Apply one global, very low-opacity grain layer. It must be pointer-events-free and must not reduce text readability.
- **Global Configuration:** Codex runtime and display settings belong in the top application bar, after the status pills, behind a compact gear button. Do not expose these settings as a chat-local control.

## 5. Layout Principles

Maintain the current compact development-tool layout, but let tonal surfaces create comfort. Use consistent panel gaps, clear borders, and restrained padding. Do not add decorative cards, hero sections, gradients, or visible imagery. The interface should stay focused on project sessions, file editing, Codex chat, control panels, previews, jobs, services, and Git workflows.
