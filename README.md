# SynapTeX

Lokale, quelloffene LaTeX-Desktop-Anwendung auf Basis von Next.js, Electron und CodeMirror 6.
Version 0.1 enthält den Editor; Kompilierung und Excel-Import sind noch Platzhalter.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev:desktop` | Next.js-Dev-Server und Electron starten |
| `npm run start:desktop` | Statischen Export bauen und in Electron starten |
| `npm run build` | Next.js-Build nach `out/` |
| `npm run package:desktop` | Installer nach `release/` bauen |
| `npm run package:dir` | Entpackte App nach `release/` bauen |
| `npm run typecheck` | TypeScript prüfen |
| `npm run lint` | ESLint ausführen |

## Architektur

- `electron/`: Main-Prozess und Preload. Der Renderer läuft mit Sandbox und Context Isolation
  und erreicht Systemfunktionen nur über die Preload-API `window.synaptexDesktop`.
- `electron/compiler.mjs`: Compiler-Schnittstelle, `electron/zipImport.mjs`: sicherer ZIP-Import.
  Abhängigkeiten des Main-Prozesses müssen unter `build.files` in `package.json` stehen.
- `src/components/`: `layout`, `editor` und `preview`.
- `src/state/`: Dokumentzustand.
- `src/lib/desktop.ts`: Zugriff auf die Desktop-API.

Entscheidungen:

- **`app://` statt `file://`:** Im Produktionsmodus liefert ein eigenes Protokoll `out/` aus.
  So funktionieren die absoluten `/_next`-Pfade, und es lässt sich eine CSP setzen.
- **Main-Prozess als `.mjs`, Preload als `.cjs`:** kein zusätzlicher Build-Schritt.
  Sandbox-Preloads müssen CommonJS sein.
- **Statischer Export:** Serverfunktionen stehen nicht zur Verfügung. Compiler, Dateizugriff und
  MCP gehören später in den Main-Prozess und werden per IPC angebunden.
