# UI Tester

A desktop application for automated testing of web UI document upload functionality. Built with Electron and Playwright, this tool allows you to batch upload JSON and CSV documents to web applications with full browser automation.

## Features

- 📁 **Folder Selection**: Browse and select folders containing your test documents
- 📄 **Document Preview**: Preview JSON and CSV files before uploading
- 🔧 **Custom Steps**: Add pre-upload automation steps (login, navigation, etc.)
- 🎭 **Browser Automation**: Powered by Playwright for reliable browser control
- 📊 **Progress Tracking**: Real-time progress updates and logging
- ⚙️ **Configurable**: Customizable selectors, wait times, and headless mode
- 💾 **Config Persistence**: Saves your configuration for next session

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation

1. Clone or download this project
2. Install dependencies:

```bash
npm install
```

3. Install Playwright browsers:

```bash
npm run install-browsers
```

## Usage

1. Start the application:

```bash
npm start
```

2. **Configure the target**:
   - Enter the URL of the web page with the upload form
   - Specify the CSS selector for the file input (default: `input[type='file']`)
   - Optionally add a submit button selector

3. **Add custom steps** (optional):
   - Click "Add Step" to add pre-upload automation steps
   - Common uses: login forms, navigating to upload page
   - Supported actions: click, fill, type, wait, navigate, press key

4. **Select documents**:
   - Click "Select Folder" to choose a folder with JSON/CSV files
   - Use checkboxes to select which files to upload
   - Click "Preview" to view file contents

5. **Start automation**:
   - Click "Start Automation" to begin
   - Watch the browser automation in action (or run headless)
   - Monitor progress and logs in real-time

## Custom Steps

Custom steps let you automate actions before the upload process begins. This is useful for:

- Logging into protected areas
- Navigating through multi-page forms
- Accepting cookie banners or modals
- Any preparatory actions

### Available Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `click` | Click an element | selector |
| `fill` | Fill an input field | selector, value |
| `type` | Type text with delays | selector, value |
| `wait` | Wait for duration | duration (ms) |
| `waitForSelector` | Wait for element | selector |
| `navigate` | Go to URL | url |
| `press` | Press keyboard key | key |

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| Target URL | The page URL with upload form | - |
| Upload Selector | CSS selector for file input | `input[type='file']` |
| Submit Selector | CSS selector for submit button | - |
| Wait After Upload | Delay after file selection (ms) | 2000 |
| Wait After Submit | Delay after clicking submit (ms) | 3000 |
| Headless Mode | Run browser invisibly | false |

## Development

To run in development mode with DevTools:

```bash
npm start -- --dev
```

## Project Structure

```
UITester/
├── package.json
├── README.md
├── src/
│   ├── main.js           # Electron main process
│   ├── preload.js        # IPC bridge
│   ├── automation.js     # Playwright automation engine
│   └── renderer/
│       ├── index.html    # UI markup
│       ├── styles.css    # Styling
│       └── renderer.js   # UI logic
└── assets/
    └── icon.png          # App icon
```

## Troubleshooting

### Browser doesn't launch
- Ensure Playwright browsers are installed: `npm run install-browsers`
- Try running without headless mode first

### Files not uploading
- Check that your file input selector is correct
- Use browser DevTools to inspect the actual selector
- Some sites use hidden file inputs - try selecting the parent element

### Custom steps not working
- Verify selectors are correct using browser DevTools
- Add wait steps between actions if the page loads slowly
- Check the logs for error messages