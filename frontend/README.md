# Frontend

Chess application frontend built with [Next.js](https://nextjs.org) 16, React 19, and [shadcn/ui](https://ui.shadcn.com).

## Prerequisites

- [Bun](https://bun.sh) 1.x

## Getting started

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `bun run dev`        | Start development server       |
| `bun run build`      | Production build               |
| `bun run start`      | Start production server        |
| `bun run lint`       | Run ESLint                     |
| `bun run format`     | Format with Prettier           |
| `bun run typecheck`  | TypeScript type-check          |

## Tech stack

- **[Next.js](https://nextjs.org)** 16 — App Router, React Server Components
- **[React](https://react.dev)** 19
- **[TypeScript](https://www.typescriptlang.org)** 6
- **[Tailwind CSS](https://tailwindcss.com)** 4
- **[shadcn/ui](https://ui.shadcn.com)** — component primitives
- **[@base-ui/react](https://base-ui.com)** — headless UI primitives
- **[@tabler/icons-react](https://tabler.io/icons)** — icons
- **[next-themes](https://github.com/pacocoursey/next-themes)** — dark/light mode

## Project structure

```
app/               App Router pages and layouts
  globals.css      Global styles
  layout.tsx       Root layout
  page.tsx         Home page
components/        React components
  pieces/          SVG chess piece components
  ui/              shadcn/ui primitives
  theme-provider   Theme provider
lib/               Utility functions
public/            Static assets
```
