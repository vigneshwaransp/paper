# Contributing to Paper

First off, thank you for considering contributing to Paper! It is people like you who make the open-source AI community a great place to build, learn, and collaborate.

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## How Can I Contribute?

### 1. Reporting Bugs
- **Check if it has already been reported:** Search the [Issues](https://github.com/vigneshwaransp/paper/issues) tab.
- **Create a detailed bug report:** Use our bug report issue template, providing clear steps to reproduce, expected vs. actual outcomes, browser versions, and logs.

### 2. Suggesting Features
- **Open an Issue:** Clearly outline the proposed feature, the use cases it solves, and how it aligns with the project goals.
- **Provide UI mockups or architecture ideas** if applicable.

### 3. Submitting Pull Requests (PRs)
We welcome contributions via Pull Requests! To get started:
1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/paper.git
   cd paper
   ```
3. **Set up the upstream remote**:
   ```bash
   git remote add upstream https://github.com/vigneshwaransp/paper.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Configure environment variables**:
   Create a `.env` file based on `.env.example` and add your development API keys:
   ```bash
   cp .env.example .env
   ```
6. **Create a descriptive feature branch**:
   ```bash
   git checkout -b feature/my-amazing-feature
   ```
7. **Make your changes** following our coding conventions.
8. **Test locally** by starting the server:
   ```bash
   npm run dev # or npm start
   ```
9. **Commit your changes**. We follow a clean commit style:
   - Use imperative present tense ("Add feature", "Fix issue")
   - Keep commits atomic and logical.
10. **Push your branch** to your fork:
    ```bash
    git push origin feature/my-amazing-feature
    ```
11. **Submit a Pull Request** against the `main` branch. Complete the PR template in detail.

---

## Coding Conventions

- **Indentation:** Use 2 spaces for indentation (defined in `.editorconfig`).
- **Styling:** Use Vanilla CSS (defined in `style.css`) and respect the specialist workspace override classes (e.g., `.app-layout.workspace-*`).
- **API Keys & Secrets:** **NEVER** commit secrets, passwords, or active API keys. Ensure client-side JavaScript only interacts with backend proxy endpoints or handles user-provided keys from the settings UI.
- **Comments:** Document helper functions and non-obvious logic using JSDoc.

## Community & Help

If you have questions, please feel free to:
- Browse our [SUPPORT.md](SUPPORT.md) guide.
- Open a question using our Question issue template.
- Participate in discussions.
