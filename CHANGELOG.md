# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-07-05

### Added
- **Initial Public Release:** Launch of the Paper Personal AI Companion.
- **Multiple AI Providers Support:** Built-in support for OpenRouter, Mistral, NVIDIA NIMs, and Gemini API keys.
- **Specialist Personas & Workspaces:** Multiple curated modes (Core Assistant, Maths Solver, Physics Sketcher, Poetry & Writing, CS Compiler, Artistic Illustrator, YouTube Companion, Translator, and Web Browser) with unique styles and themes (e.g. Chalkboard green, CS terminal black, English sepia).
- **Web Browser Persona:** Real-time search integration with Yahoo! Search to supply straight, up-to-date facts to the AI context.
- **Interactive Source Cards:** Displays styled, clickable source links below search-augmented responses, with smart HTML entity decoding.
- **Text-to-Speech (TTS):** Dynamic browser voice synthesis for reading messages aloud, with Auto-Speak toggle support.
- **Image OCR Reader:** Allows drag-and-drop or browsing images to extract text and attach it directly to AI prompts.
- **Database Backup & Sync:** Support for backing up and restoring active chat sessions to a Supabase PostgreSQL instance.
- **Mobile-Responsive UI:** Fully responsive design with wobbly, ink-drawn borders, animations, and dark/light modes.
- **Developer Onboarding:** Standardized `.env.example`, `.gitattributes`, `.editorconfig`, issue/PR templates, and custom local companion server.

### Changed
- Refactored API key resolution to ensure zero hardcoded secrets remain in Git history.
- Relocated API keys to environment variables and user-controlled settings forms.
- Re-styled layout colors in Web Browser workspace to fix light-background style conflicts under the dark cyber theme.
