# Peer Coaching Network

Collaborative Calendly for coaches. Built with React, TypeScript, Vite, Firebase (Cloud Firestore + Functions), and Google Calendar integrations.

---

## Local Development Setup

To prevent Google OAuth sign-in redirect loops caused by Third-Party Cookie blocking on modern browsers, **all local development must be run using a custom local domain over HTTPS**.

### Prerequisites

#### 1. Setup Local Hosts Domain
You must map `127.0.0.1` to `local.peercoachingnetwork.com` in your hosts file.

On macOS/Linux:
1. Open terminal and run:
   ```bash
   sudo nano /etc/hosts
   ```
2. Append the following entry at the bottom of the file:
   ```text
   127.0.0.1 local.peercoachingnetwork.com
   ```
3. Save the file (`Ctrl+O`, `Enter`) and exit (`Ctrl+X`).

#### 2. Localhost Access Blocked
Accessing the web application via `http://localhost:5173` or `http://127.0.0.1:5173` is explicitly blocked. If opened, a configuration error screen will be displayed directing you to the custom domain.

Always access the app locally via:
* **`https://local.peercoachingnetwork.com:5173`**

---

## Commands

Here are the primary commands for building, running, and validating the application:

* **Install Dependencies**:
  ```bash
  make install
  ```
* **Run Dev Server**: Starts the Vite local server bound to the custom domain over HTTPS:
  ```bash
  make run
  ```
* **Linting & Type-checking**: Runs TypeScript compiler checks and ESLint:
  ```bash
  make lint
  ```
* **Run Tests**: Runs Vitest suite:
  ```bash
  npm run test
  ```