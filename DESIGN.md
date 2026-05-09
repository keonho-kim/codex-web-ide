# Design System: Codex Web IDE

## 1. Visual Theme & Atmosphere

Codex Web IDE should feel like a quiet local development notebook: functional, low-glare, and paper-like without becoming decorative. The interface uses light gray paper tones instead of pure white, with subtle surface steps to separate the project rail, workbench, editor, chat, and control panels.

The target atmosphere is closer to an e-book reader than a SaaS dashboard. Backgrounds should recede, controls should remain calm, and color should act as punctuation for state, selection, and action. Avoid bright white expanses, glossy cards, strong shadows, saturated gradients, and visible texture patterns.

Texture is allowed only as a barely perceptible paper or concrete grain. It should soften large flat surfaces without drawing attention to itself. If a user notices the texture as a pattern, it is too strong.

## 2. Color Palette & Roles

- **Paper Gray Base (#eeece7):** App page background. Used behind all panels to reduce glare and create a quiet e-book tone.
- **Soft Paper Canvas (#f8f7f3):** Primary work surfaces such as the workbench, editor, and dialogs. This replaces pure white for large areas.
- **Parchment Panel (#f2f0eb):** Secondary surfaces such as sidebars, toolbar strips, and nested panels.
- **Pressed Paper (#e9e6df):** Hover and low-emphasis accent surface for controls and row highlights.
- **Warm Hairline (#d8d3c9):** Fine dividers and panel outlines. Borders should be visible but never high contrast.
- **Control Stroke (#c9c3b7):** Inputs and stronger interactive outlines.
- **Reading Ink (#232321):** Primary text. Never use absolute black for normal UI text.
- **Muted Graphite (#74716a):** Secondary text, timestamps, empty states, and subdued metadata.
- **Washed Denim Action (#4d6f91):** Primary actions, focused inputs, active icons, and main links.
- **Washed Denim Selection (#dde7ee):** Active tab, selected thread, and selected list item backgrounds.
- **Washed Denim Border (#93a9ba):** Selected item border and resize-handle hover.
- **Library Violet (#68658d):** Codex-specific status and assistant activity accents.
- **Library Violet Soft (#ece9f2):** Codex header and Codex-specific soft containers.
- **Quiet Success (#4d7a5c) / Soft Success (#e5eee4):** Healthy services and completed states.
- **Muted Amber (#8f6828) / Soft Amber (#f3ead8):** Warning states and running job indicators.
- **Muted Red (#b24b45):** Destructive actions and errors.

## 3. Typography Rules

Use the existing sans-serif UI stack for dense development workflows. Keep letter spacing at zero for UI text and avoid oversized marketing-style type. Headings should be small, clear, and utilitarian; metadata can be compact but must remain readable against the warmer gray surfaces.

Code, file paths, commands, and repository paths should continue using the monospace stack. Text contrast should be evaluated against the new soft-paper surfaces, not against pure white.

## 4. Component Stylings

- **Panels and Work Surfaces:** Use Soft Paper Canvas or Parchment Panel backgrounds with Warm Hairline borders. Prefer flat separation over shadows.
- **Sidebars and Toolbars:** Use Parchment Panel to sit one tone darker than the main editor canvas.
- **Buttons:** Primary buttons use Washed Denim Action with soft-paper foreground. Ghost and outline buttons should reveal Pressed Paper on hover.
- **Tabs and Selected Rows:** Use Washed Denim Selection with Washed Denim Border for selection. Avoid saturated blue fills.
- **Inputs and Dialogs:** Inputs use Soft Paper Canvas with Control Stroke. Dialogs use the same paper palette as the app, not pure white.
- **Status Chips:** Use quiet semantic soft fills. Do not introduce bright green, yellow, or red surfaces.
- **Texture:** Apply one global, very low-opacity grain layer. It must be pointer-events-free and must not reduce text readability.

## 5. Layout Principles

Maintain the current compact development-tool layout, but let tonal surfaces create comfort. Use consistent panel gaps, clear borders, and restrained padding. Do not add decorative cards, hero sections, gradients, or visible imagery. The interface should stay focused on project sessions, file editing, Codex chat, control panels, previews, jobs, services, and Git workflows.
