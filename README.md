# Peer Coaching Network

Collaborative Calendly for coaches. Built with React, TypeScript, Vite, Firebase (Cloud Firestore + Functions), and Google Calendar integrations.

---

## Local Development Setup

To run the application locally connected to your Firebase Dev environment:

1. Copy `.env.sample` to `.env.development` and ensure your Firebase dev credentials are configured.
2. Start the local development server:
   ```bash
   make run
   ```
3. Open **`http://localhost:5173`** in your browser.

---

## Commands

Here are the primary commands for building, running, and validating the application:

* **Install Dependencies**:
  ```bash
  make install
  ```
* **Run Dev Server**: Starts the Vite local development server on `http://localhost:5173`:
  ```bash
  make run
  ```
* **Build Application**: Compiles shared packages, packages functions, and builds production client assets:
  ```bash
  make build
  ```
* **Deploy Application**: Builds and deploys Firestore configurations (rules/indexes), Cloud Functions, and hosting assets:
  ```bash
  make deploy
  ```
* **Linting & Type-checking**: Runs TypeScript compiler checks and ESLint:
  ```bash
  make lint
  ```
* **Run Tests**: Runs Vitest suite:
  ```bash
  npm run test
  ```