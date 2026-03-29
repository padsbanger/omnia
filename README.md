# Omnia

Omnia is a desktop workspace organizer app that unifies multiple web-based applications (like messaging, email, productivity tools, and more) into a single, to boost productivity and simplify multitasking

---

## 🚀 Quick Start

### Installation

Newest version for specific platform available [here](https://github.com/padsbanger/omnia/releases):


### Development

Make sure you have the following installed before running this project:

- **Node.js** (v18.0 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **Git** - [Download](https://git-scm.com/)

---

## 🔧 Setup
### 1. Clone the repository

```bash
git clone https://github.com/padsbanger/omnia.git
cd omnia
```

### 2. Install dependencies

```bash
npm install
```

This will install all necessary packages listed in `package.json`.

### 3. Setup environment variables

Create a `.env` file in the root directory based on `.env.example` (if it exists):

```bash
cp .env.example .env  # if .env.example exists
```

Edit `.env` as needed for your configuration.

---

## 🏃 Development Mode

Run the development server with hot-reload:

```bash
npm start
```

This will:
- Start the Electron app in development mode
- Enable Vite's hot module replacement
- Allow you to see changes instantly without rebuilds

**Hot-reload tips:**
- Edit source files and see changes automatically
- Browser and Electron processes are synced
- Console logs appear in both terminals and the app

---

## 📦 Building for Production

### Build configuration

Before building, the project will:
- Bundle all dependencies
- Minify and optimize assets
- Generate platform-specific builds
- Create installers for all supported platforms

### Available build targets

| Command | Description |
|---------|-------------|
| `npm run package` | Build all platforms (universal) |
| `npm run make` | Build for current platform only |

### Platform-specific builds

Depending on your OS and installed makers, you'll get:

**Windows:**
- `.exe` installer with auto-updates
- ZIP archive (manual installation)
- Portable executable

**macOS:**
- `.dmg` installer
- `.zip` archive

**Linux:**
- `.deb` package (Debian/Ubuntu)
- `.rpm` package (Fedora/CentOS)
- `.AppImage` (if configured)
- AUR package (Arch Linux)

### Customizing builds

Edit `forge.config.ts` to configure:
- Window settings (size, position, decorations)
- App permissions and capabilities
- Bundle size optimization
- Asset optimization
- Build targets and platforms

---

## 🧹 Code Quality & Linting

Check for linting errors and style issues:

```bash
npm run lint
```

This uses ESLint with TypeScript support to catch common errors and style violations.

---

## 📚 Project Structure

```
src/
├── assets/          # Static assets (icons, images, fonts)
├── common/          # Shared code between main/preload/renderer
├── main/            # Main process code (app lifecycle, IPC handlers)
│   └── windows/     # Window creation and management
├── preload.ts       # Preload scripts for secure IPC
├── renderer/        # React application code
│   └── ...          # Your React components and pages
├── main.ts          # Electron main entry point
├── renderer.ts      # Renderer process entry point
└── global.d.ts      # TypeScript global augmentations
```

---

## 🛠️ Available Scripts

```bash
npm start        # Run development server (hot-reload enabled)
npm run lint     # Run ESLint on TypeScript files
npm run package  # Build for all platforms
npm run make     # Build for current platform
npm run publish  # Publish to store (GitHub releases)
```

---

## 🔒 Security Notes

This project uses **Electron Fuses** for enhanced security:

- **No-sandbox** is disabled by default (recommended for most users)
- **Node integration** is controlled via preload script
- **Context isolation** is enabled for renderer processes
- **Hardware acceleration** is configurable in `forge.config.ts`

For detailed security configuration, review:
- `forge.config.ts`
- `preload.ts`
- `.gitignore` (never commit `.env` files)

---

## 🐛 Troubleshooting

### App won't start

```bash
# Clear caches
npm cache clean --force
rm -rf node_modules && npm install
```

### Development issues

- Check browser console for JavaScript errors
- Verify `main.ts` and `renderer.ts` entry points
- Review `forge.config.ts` for window initialization errors

### Build fails on Linux

Install required dependencies:

**Ubuntu/Debian:**
```bash
sudo apt-get install libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2
```

**Fedora:**
```bash
sudo dnf install nss atk libdrm libxkbcommon libxcomposite libxdamage libxrandr libgbm
```

---

## 📝 License

MIT License

---

## 👤 Author

**Michał Lach**
Email: kontakt@michal-lach.pl

---

*Built with ❤️ using [Electron Forge](https://www.electron-forge.io/)*