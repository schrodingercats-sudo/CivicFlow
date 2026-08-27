---
name: agentation
description: >
  Visual UI/UX feedback tool for agents (https://www.agentation.com/).
  Use when receiving structured or pasted UI annotations from the Agentation toolbar,
  or when inspecting element-level design feedback, styling changes, positioning,
  and layout adjustments requested on CivicFlow interfaces.
---

# Agentation: Visual UI/UX Feedback for Agents

Agentation allows users to click, select, or drag over UI elements on CivicFlow to leave visual annotations and design critiques.

## How to Use

1. **Toolbar in CivicFlow**: `<Agentation />` is mounted at root in `frontend/src/App.jsx`.
2. **Annotate in Browser**:
   - Open the web app (local or production at https://civicflow-app.vercel.app).
   - Click the toolbar at bottom right.
   - Click any element, highlight text, or draw an area box.
   - Add comments detailing requested UI/UX improvements.
3. **Send Feedback**:
   - Click "Copy" on the Agentation toolbar.
   - Paste the output in the prompt.

## Agent Workflow

When receiving Agentation feedback:
- Match selectors/text/DOM path to React files in `frontend/src/pages/` or `frontend/src/components/`.
- Apply CSS/layout/component changes.
- Build and verify.
