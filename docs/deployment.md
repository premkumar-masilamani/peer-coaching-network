# Peer Coaching Network — Deployment & Infrastructure Guide

This document outlines the step-by-step setup required to deploy and maintain the **Peer Coaching Network** application in Google Cloud, Firebase, and GitHub.

---

## ☁️ 1. Google Cloud Platform (GCP) Setup

A Service Account is required to allow GitHub Actions to securely build and deploy hosting assets, Firestore security rules, and database indexes.

### Step 1: Create a Service Account
1. Open the [Google Cloud Console IAM & Admin](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. Select your project (`peer-coaching-network-dev` or `peer-coaching-network`).
3. Click **Create Service Account**.
4. Name the service account (e.g., `github-actions-deployer`).
5. Click **Create and Continue**.

### Step 2: Assign Required IAM Roles
To deploy Firestore rules, indexes, and Hosting assets, the service account must be granted the following roles:
*   **Firebase Hosting Admin** (`roles/firebasehosting.admin`) — Required to deploy and release files to Firebase Hosting.
*   **Firebase Rules Admin** (`roles/firebaserules.admin`) — Required to deploy and modify Firestore Security Rules.
*   **Cloud Datastore Index Admin** (`roles/datastore.indexAdmin`) — Required to deploy and build Firestore database indexes.

Click **Continue** and then click **Done**.

### Step 3: Generate the Service Account JSON Key
1. In the Service Accounts list, click on the newly created service account.
2. Select the **Keys** tab.
3. Click **Add Key** > **Create new key**.
4. Select **JSON** as the key type and click **Create**.
5. Save the downloaded JSON file securely (do not commit this file to Git).

---

## 🔥 2. Firebase Setup

### Step 1: Enable Firestore Databases
Because this project utilizes custom-named databases for each environment (e.g. `pcn-dev` for development, `pcn-prod` for production):
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. Navigate to **Firestore Database** in the left menu.
4. If you are setting up the project for the first time, click **Create database**.
5. When prompted, select **Start in production mode** or **Start in test mode**.
6. Set the **Database ID** (e.g. `pcn-dev` for Dev, `pcn-prod` for Production).
7. Select the appropriate region (e.g., `asia-south1` or your preferred location).
8. Click **Enable**.

### Step 2: Enable Firebase Authentication
1. Navigate to **Authentication** in the Firebase Console.
2. Click **Get Started** (if not already enabled).
3. Under the **Sign-in method** tab, enable the **Google** provider.
4. Configure the Web SDK configuration and OAuth consent screen with your support email and project details.
5. In **Authorized domains**, make sure the custom domain (or default `firebaseapp.com` domain) is added.

---

## 🐙 3. GitHub Configuration

Configure repository variables and secrets to support build-time environment injection and automated deployment.

### Secrets (Administrative Credentials)
Secrets are encrypted and cannot be viewed once saved. Store your service account JSON keys here:
1. Navigate to your GitHub repository > **Settings** > **Secrets and variables** > **Actions**.
2. Under **Repository secrets**, click **New repository secret**.
3. Add the following secrets:
   *   `DEV_FIREBASE_SERVICE_ACCOUNT` — Paste the full contents of the Dev Service Account JSON key.
   *   `PROD_FIREBASE_SERVICE_ACCOUNT` — Paste the full contents of the Production Service Account JSON key.

### Variables (Client-Side Configuration)
Variables are public configuration keys injected into the client bundle at build-time.
1. In the same Settings screen, select the **Variables** tab.
2. Click **New repository variable**.
3. Add the following variables:

#### Development Environment (`dev`):
*   `DEV_VITE_FIREBASE_PROJECT_ID`: The ID of your Dev GCP/Firebase project (e.g., `peer-coaching-network-dev`).
*   `DEV_VITE_FIRESTORE_DATABASE_ID`: The ID of your Dev Firestore database (e.g., `pcn-dev`).
*   `DEV_VITE_FIREBASE_API_KEY`: Browser API key found in Firebase project settings.
*   `DEV_VITE_FIREBASE_AUTH_DOMAIN`: The auth handler domain (e.g. `dev.peercoachingnetwork.com`).
*   `DEV_VITE_FIREBASE_STORAGE_BUCKET`: Storage bucket URL (e.g., `peer-coaching-network-dev.firebasestorage.app`).
*   `DEV_VITE_FIREBASE_MESSAGING_SENDER_ID`: Cloud Messaging Sender ID.
*   `DEV_VITE_FIREBASE_APP_ID`: Firebase Web App ID.
*   `DEV_VITE_FIREBASE_MEASUREMENT_ID`: Google Analytics measurement ID.
*   `DEV_VITE_LOG_LEVEL`: Logger verbosity level (`debug`, `info`, `warn`, or `error`).

#### Production Environment (`production`):
*   `PROD_VITE_FIREBASE_PROJECT_ID`: The ID of your Production GCP/Firebase project (e.g., `peer-coaching-network`).
*   `PROD_VITE_FIRESTORE_DATABASE_ID`: The ID of your Production Firestore database (e.g., `pcn-prod`).
*   `PROD_VITE_FIREBASE_API_KEY`: Production browser API key.
*   `PROD_VITE_FIREBASE_AUTH_DOMAIN`: Production auth handler domain.
*   `PROD_VITE_FIREBASE_STORAGE_BUCKET`: Production storage bucket URL.
*   `PROD_VITE_FIREBASE_MESSAGING_SENDER_ID`: Production messaging sender ID.
*   `PROD_VITE_FIREBASE_APP_ID`: Production app ID.
*   `PROD_VITE_FIREBASE_MEASUREMENT_ID`: Production analytics ID.
*   `PROD_VITE_LOG_LEVEL`: Production logger verbosity level (usually `error` or `warn`).

---

## 🚀 4. Triggering the Deployment

The deployment workflow is fully automated via GitHub Actions:
1. Navigate to your GitHub repository > **Actions** > **Deploy to Firebase** workflow.
2. Click **Run workflow** dropdown on the right side.
3. Select the branch you want to build (e.g., `main`).
4. Select the target environment: **`dev`** (Development) or **`production`**.
5. Click **Run workflow**.

The workflow will:
1. Build the client bundle injecting the selected environment's variables.
2. Run unit tests.
3. Deploy Firestore rules and indexes for the specific database ID.
4. Deploy the production hosting assets.
5. Print detailed verbose logs under the deployment step thanks to the `--debug` flag.
