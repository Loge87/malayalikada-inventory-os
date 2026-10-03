This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## UI classes cheat sheet

Every color, radius, shadow, font, and spacing value in this app lives in `src/app/theme.css`. Every reusable class name below lives in `src/app/ui.css`. See CLAUDE.md's Styling rules section before adding a new one-off style.

| Class | What it looks like | Where to edit it |
|---|---|---|
| **Page layout** | | |
| `.page` | A page's outer wrapper — full width, stacked vertically, standard outer padding | `ui.css` (layout) · `theme.css` (`--space-page-padding`, `--space-section-gap`) |
| `.page-header` | A page's title + subtitle, grouped | `ui.css` |
| `.page-title` | The big heading at the top of a page | `ui.css` (layout) · `theme.css` (`--text-xl`, `--foreground`) |
| `.page-subtitle` | The one-line description under a page title | `ui.css` (layout) · `theme.css` (`--text-sm`, `--muted-foreground`) |
| `.section` | A sub-region within a page, same vertical rhythm as `.page` | `ui.css` (layout) · `theme.css` (`--space-section-gap`) |
| `.stack` | A tight vertical stack of elements | `ui.css` |
| `.row` | A horizontal row of elements, vertically centered | `ui.css` |
| **Buttons** | | |
| `.btn` | Base shape/height/focus ring/press/disabled state every button shares | `ui.css` (layout) · `theme.css` (`--radius-button`, `--space-control-height`, `--ring`) |
| `.btn-primary` | The one solid brand-green action on a page | `theme.css` (`--primary`, `--primary-hover`, `--primary-active`) |
| `.btn-secondary` | A filled, neutral-color button | `theme.css` (`--secondary`) |
| `.btn-danger` | A soft red "delete/remove" button | `theme.css` (`--destructive`) |
| `.btn-ghost` | No fill/border until hovered | `theme.css` (`--muted`, `--foreground`) |
| `.btn-icon` | A square, icon-only button | `ui.css` |
| `.btn-sm` | A smaller button for toolbars/table rows | `ui.css` |
| `.btn-block` | Full width on mobile, natural width from `sm:` up | `ui.css` (base rule + Responsive rules block) |
| **Cards** | | |
| `.card` | The app's standard white/dark panel surface | `theme.css` (`--card`, `--radius-card`, `--shadow-card`) |
| `.card-header` | A card's top region (title/description/action) | `ui.css` |
| `.stat-card` | A dashboard summary tile — equal height across a row | `ui.css` |
| `.stat-label` | The small caption under a stat card's number | `theme.css` (`--muted-foreground`) |
| `.stat-value` | The big number in a stat card | `theme.css` (`--text-2xl`) |
| **Forms** | | |
| `.field` | Wrapper around one label + control (+ hint/error) | `ui.css` |
| `.field-label` | A field's own label | `ui.css` |
| `.field-hint` | Helper text under a control | `theme.css` (`--muted-foreground`) |
| `.field-error` | Validation error text under a control | `theme.css` (`--destructive`) |
| `.input` | A single-line text control | `theme.css` (`--input`, `--radius-input`) |
| `.textarea` | A multi-line text control | `theme.css` (`--input`, `--radius-input`) |
| `.select` | A dropdown trigger | `theme.css` (`--input`, `--radius-input`) |
| `.checkbox` | A checkbox, filled with `--primary` once checked | `theme.css` (`--primary`) |
| `.form-grid` | 2 columns on desktop, 1 on mobile | `ui.css` (base rule + Responsive rules block) |
| **Tables** | | |
| `.table` | The table element | `ui.css` |
| `.table-head` | The header row | `theme.css` (`--muted`, `--border`) |
| `.table-row` | One data row — hover and `aria-selected` states | `theme.css` (`--muted`, `--primary-tint`) |
| `.cell-number` | A right-aligned numeric cell | `ui.css` |
| **Status pills** | | |
| `.pill` | The fully-rounded pill shape | `theme.css` (`--radius-pill`) |
| `.pill-success` / `.pill-warning` / `.pill-critical` / `.pill-neutral` | In-stock / low-stock / out-of-stock / inactive labels | `theme.css` (`--status-*`, `--status-*-bg`) |
| **Navigation** | | |
| `.sidebar` | The desktop sidebar's surface | `theme.css` (`--sidebar-background`, `--sidebar-border`) |
| `.nav-item` / `.nav-item-active` / `.nav-item-disabled` | A sidebar/menu destination, at rest / current page / "coming soon" | `theme.css` (`--sidebar-*`) |
| `.bottom-nav` / `.bottom-nav-item` | The mobile bottom tab bar and its destinations | `theme.css` (`--background`, `--sidebar-border`) |
| `.profile-block` | The email/role/theme-toggle/sign-out block | `theme.css` (`--sidebar-border`) |
| **Panels and overlays** | | |
| `.side-panel` | A docked panel that scrolls independently of the page | `ui.css` (pair with the `scrollbar-hover-thin` utility in `globals.css`) |
| `.dialog` / `.dialog-overlay` | A modal dialog and its backdrop | `theme.css` (`--popover`, `--radius-card`) |
| `.dropdown-menu` / `.dropdown-item` | A dropdown/context menu and its rows | `theme.css` (`--popover`, `--accent`) |
| **Tabs and filters** | | |
| `.tabs` / `.tab` | A tab switcher and one tab (active state via `[data-active]`) | `theme.css` (`--muted`, `--foreground`) |
| `.filter-bar` | A row of filter controls above a list/table | `ui.css` |
| `.filter-chip` | One active filter shown as a chip | `theme.css` (`--secondary`, `--border`) |
| **Feedback** | | |
| `.toast` / `.toast-success` / `.toast-error` | A toast notification and its icon colors | `theme.css` (`--popover`, `--status-success`, `--destructive`) |
| `.empty-state` | A "nothing here" message in place of a list | `ui.css` |
| `.skeleton` | A pulsing loading placeholder | `theme.css` (`--muted`) |

A few of these (`.page*`, `.section`, `.stack`, `.row`, `.filter-bar`, `.filter-chip`, `.empty-state`, `.skeleton`, `.table-row`'s mobile card variant) are defined but not yet used by any page or component — see their comments in `ui.css` for why. Everything else above is live in the app today.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
