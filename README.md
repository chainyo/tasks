# Daily Task Sticker

Daily Task Sticker is a tiny macOS sticky task app built with Tauri, Vite, React, TanStack Query, Tailwind CSS, and shadcn-style components.

It keeps a compact always-on-top checklist in a selectable screen corner. Tasks can be edited from the macOS menu bar icon, reordered from the sticky, and checked off during the day. When every task is complete, the app can hide the sticky until the next task day. A task day starts at 5:00 AM local computer time.

Task content and daily completion state are stored in a local SQLite file managed by the Rust backend.

## Requirements

- macOS on Apple Silicon
- Bun
- Rust
- Tauri system dependencies

## Install Dependencies

```sh
bun install
```

## Development

Run the Tauri app in development mode:

```sh
bun run tauri dev
```

Run the Vite frontend only:

```sh
bun run dev
```

## Checks

Run frontend tests with coverage:

```sh
bun run test
```

Run Rust tests:

```sh
bun run test:rust
```

Run the Biome linter:

```sh
bun run lint
```

Format the repo:

```sh
bun run format
```

## Build

Build the production frontend:

```sh
bun run build
```

Build the macOS app and DMG:

```sh
bun run tauri build
```

The generated app is written to:

```sh
src-tauri/target/release/bundle/macos/Daily Task Sticker.app
```

The generated DMG is written to:

```sh
src-tauri/target/release/bundle/dmg/Daily Task Sticker_0.1.0_aarch64.dmg
```

## Install Locally

After building, copy the app bundle into `/Applications`:

```sh
cp -R "src-tauri/target/release/bundle/macos/Daily Task Sticker.app" /Applications/
```

Or open the generated DMG and drag `Daily Task Sticker.app` into `Applications`.
