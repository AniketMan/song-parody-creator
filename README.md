# Song Parody Creator

A side-by-side lyric editor for writing song parodies. Paste original lyrics on the left, freely edit your parody on the right. Words are automatically linked by position — modified words get highlighted so you always know what you're replacing.

## Features

- **Dual editable panels** — both original and parody sides are free-typing textareas
- **Automatic word linking** — words matched by line and position
- **Live diff highlighting** — amber highlight on changed parody words, red tint on corresponding original words
- **Modification counter** — tracks how many words you've changed
- **Copy parody** — one-click copy of your parody text
- **Resizable panels** — drag the divider to adjust panel widths
- **Local only** — no server, no accounts, no data leaves your browser

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS 4
- react-resizable-panels

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Usage

1. Paste your original song lyrics into the input area
2. Click "Load Lyrics" — the text populates both panels
3. Edit either side freely
4. Changed words are highlighted automatically
5. Click "Copy Parody" to grab your finished parody text

## License

MIT
