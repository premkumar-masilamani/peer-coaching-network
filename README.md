# Peer Coaching Network

Collaborative Calendly for coaches. Built with React, TypeScript, Vite, Firebase (Cloud Firestore + Functions), and Google Calendar integrations.

---

## Infrastructure as Code (IaC)

The cloud infrastructure for this project (GCP projects, Firebase Authentication, Cloud Firestore multi-databases, Cloud Storage buckets, OAuth 2.0 Web Client credentials, and service accounts) is managed as Infrastructure as Code (IaC) with Terraform.

Repository: **[peer-coaching-network-infrastructure](https://github.com/premkumar-masilamani/peer-coaching-network-infrastructure)**

---

## Local Development Setup

To run the application locally connected to your Firebase Dev environment:

1. Ensure `.env.development` is present with your Firebase dev credentials (see `.env.sample` for reference).
2. Start the local development server:
   ```bash
   make run
   ```
3. Open **`http://localhost:5173`** in your browser.
4. To run the landing website locally:
   ```bash
   make landing
   ```
   Open **`http://localhost:5174`** in your browser.

---

## Commands

Here are the primary commands for building, running, testing, and deploying the application across development and production environments:

### Development

* **Install Dependencies**:
  ```bash
  make install
  ```
* **Run App Dev Server**: Starts the web app Vite development server on `http://localhost:5173`:
  ```bash
  make run
  ```
* **Run Landing Dev Server**: Starts the landing website Vite development server on `http://localhost:5174`:
  ```bash
  make landing
  ```
* **Build (Dev)**: Compiles shared packages, packages functions, and builds client assets using `.env.development`:
  ```bash
  make build
  # or
  make build-dev
  ```
* **Deploy (Dev)**: Builds and deploys Firestore configurations (rules/indexes), Cloud Functions, and hosting assets to Dev (`pcn-dev-506605`):
  ```bash
  make deploy
  # or
  make deploy-dev
  ```
* **Fetch Dev Cloud Function Logs**: Reads live execution logs from deployed functions in Google Cloud:
  ```bash
  make logs
  # or
  make logs-dev
  make logs LINES=50
  make logs FUNC=updateUserProfileAndSchedule
  ```

---

### Production

* **Build (Prod)**: Compiles shared packages, packages functions, and builds production client assets using `.env.production`:
  ```bash
  make build-prod
  ```
* **Deploy (Prod)**: Builds and deploys Firestore configurations (rules/indexes), Cloud Functions, and hosting assets to Prod (`pcn-prod-507207`):
  ```bash
  make deploy-prod
  ```
* **Fetch Prod Cloud Function Logs**: Reads live execution logs from deployed functions in Google Cloud:
  ```bash
  make logs-prod
  make logs-prod LINES=50
  make logs-prod FUNC=updateUserProfileAndSchedule
  ```

---

### Quality & Testing

* **Linting & Type-checking**: Runs TypeScript compiler checks and ESLint across all workspaces:
  ```bash
  make lint
  ```
* **Run Tests**: Runs the Vitest test suite:
  ```bash
  npm run test
  ```