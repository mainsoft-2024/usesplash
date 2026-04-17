# Research: react-spinners-kit

Date: 2026-04-13

## Summary

`react-spinners-kit` is a collection of loading spinner components built with styled-components. The package offers 20+ spinner types with customizable props for size, color, and loading state. However, it has not been updated since 2019 and explicitly supports React 16.12.0-17.x only — **it is NOT compatible with React 19**.

---

## 1. Available Spinners (Component Names)

The package includes the following spinner components:

| | | | |
|---|---|---|---|
| BallSpinner | BarsSpinner | CircleSpinner | CubeSpinner |
| DominoSpinner | FillSpinner | FireworkSpinner | FlagSpinner |
| GridSpinner | GuardSpinner | HeartSpinner | GooSpinner |
| CombSpinner | JellyfishSpinner | TraceSpinner | ClassicSpinner |
| MetroSpinner | WhisperSpinner | PushSpinner | RingSpinner |
| SwishSpinner | PongSpinner | RainbowSpinner | |

---

## 2. Props

All spinners accept these common props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `loading` | boolean | `true` | When `false`, renders nothing |
| `size` | number | varies (20-100) | Size of the spinner |
| `sizeUnit` | string | `'px'` | Unit for size (px, em, rem, etc.) |
| `color` | string | varies | Primary color |
| `frontColor` | string | - | Front color (for dual-color spinners like CubeSpinner) |
| `backColor` | string | - | Background/back color |

### Per-Spinner Default Values

| Spinner | size | color | frontColor | backColor |
|---------|------|-------|------------|-----------|
| BallSpinner | 40 | #00ff89 | - | - |
| BarsSpinner | 40 | #00ff89 | - | - |
| CircleSpinner | 30 | #fff | - | - |
| CubeSpinner | 25 | - | #00ff89 | #686769 |
| DominoSpinner | 100 | #686769 | - | - |
| JellyfishSpinner | 60 | #4b4c56 | - | - |
| TraceSpinner | 70 | - | #00ff89 | #4b4c56 |
| WhisperSpinner | 50 | #fff | #4b4c56 | #00ff89 |

---

## 3. Import Examples

```jsx
// Import individual spinners
import { PushSpinner, RingSpinner, CircleSpinner } from "react-spinners-kit";

// Basic usage
function App() {
  return (
    <div>
      <PushSpinner size={50} color="#00ff89" />
      <RingSpinner size={40} color="#fff" />
    </div>
  );
}

// Controlled loading
function LoadingComponent({ isLoading }) {
  return <CircleSpinner loading={isLoading} size={30} />;
}
```

---

## 4. React 19 Compatibility

**NOT COMPATIBLE WITH REACT 19.**

The package.json explicitly declares React 16.12.0 as a dependency with an upper bound of `<18.0.0`:

```
"peerDependencies": {
  "react": "^16.12.0",
  "react-dom": "^16.12.0",
  "styled-components": ">=2.0.0"
}
```

The package has not been updated since December 2019 (v1.9.1). There is a community fork (`@slnsw/react-spinners-kit` v1.9.2 from 2022) but it also does not support React 18+ or React 19.

---

## 5. Install Command

```bash
# npm
npm install --save react-spinners-kit

# or yarn
yarn add react-spinners-kit
```

---

## Source

- NPM: https://www.npmjs.com/package/react-spinners-kit
- GitHub: https://github.com/dmitrymorozoff/react-spinners-kit
- Demo: https://dmitrymorozoff.github.io/react-spinners-kit/