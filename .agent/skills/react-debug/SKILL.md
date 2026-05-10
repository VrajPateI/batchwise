---
name: react-debug
description: Protocol for fixing React rendering crashes (White Screen/Blank Page) in Recharts or similar libraries.
---

# React Debugging Protocol

## Trigger
Use this skill when the user reports:
- "White screen" or "Blank page"
- "Render error"
- Issues with Recharts, AG Grid, or data-heavy components.

## Procedure

### 1. The "Safe Render" Pattern
Never assume API data exists. You must implement **Conditional Rendering** immediately.

**Bad Pattern (Causes Crash):**
```jsx
<Chart data={studentData} />