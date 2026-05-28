<div align="center">
  <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(to top right, #a855f7, #6366f1); margin: 0 auto 20px;"></div>
  <h1>Ghost UI</h1>
  <p><strong>Browser-Native UX Intelligence Engine</strong></p>
</div>

Ghost UI is a browser extension that acts as a real-time UX and Accessibility auditor. It injects directly into the live DOM of any webpage, analyzes elements against design heuristics, and surfaces usability problems right where they occur using interactive overlays.

## ✨ Features

- **Live DOM Scanning**: Seamlessly scans Single Page Applications (SPAs) and tracks elements in real-time as you scroll.
- **Draggable Tooltips**: Interactive bounding boxes with Draggable Tooltips and SVG leader lines so your view is never blocked.
- **Dynamic UX Scoring**: A beautiful popup dashboard that reads the live state of the page to calculate an overall UX score.
- **Real-Time Filtering**: Instantly toggle rules on or off right from the popup.

### 🧠 Current Heuristics (Rules)
1. **Low Contrast**: Detects text elements that fail standard contrast ratios.
2. **Tiny Click Targets**: Flags interactive elements (buttons, links, inputs) smaller than 44x44px.
3. **Missing Alt Text**: Finds `<img>` tags completely missing accessibility descriptions.
4. **Heading Hierarchy**: Warns when semantic heading levels are skipped (e.g., `H1` jumping straight to `H3`).
5. **Too Many CTAs**: Detects visual clutter by finding groups of heavily styled primary buttons packed too closely together.

## 🛠️ Tech Stack

- **[WXT](https://wxt.dev/)**: Next-generation framework for browser extensions.
- **React**: For declarative UI in both the Popup and the Shadow DOM content scripts.
- **TypeScript**: End-to-end type safety.
- **Tailwind CSS v4**: For beautiful, utility-first styling injected cleanly into the Shadow DOM.

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js and npm installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ghost-ui.git
   cd ghost-ui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server (This will automatically open a fresh browser instance with the extension loaded):
   ```bash
   npm run dev
   ```

### Building for Production
To package the extension for the Chrome Web Store:
```bash
npm run build
npm run zip
```
This will generate a `.zip` file in the `.output` directory ready for deployment!

---
*Built as a prototype for advanced agentic coding workflows.*
