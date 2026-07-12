.PHONY: install build-dev build-prod dev lint test test-int test-perf emulator local erd deploy-dev deploy-prod

# Default variables for dynamic overrides
N ?= 3
P95 ?= 3000

install:
	npm install
	git config core.hooksPath .githooks

build-dev:
	set -a && . ./.env.development && set +a && npm run tsc && npm run vite -- build --mode production

build-prod:
	set -a && . ./.env.production && set +a && npm run tsc && npm run vite -- build --mode production


dev:
	npm run vite -- --mode development

local:
	npm run emulator:seed && npm run vite -- --mode emulator

lint:
	npm run tsc && npm run eslint

# Tests: Unit & Integration run with coverage by default
test:
	npm run vitest -- --project=unit --coverage

test-int:
	TEST_USER_COUNT=$(N) npm run vitest -- --project=integration --coverage

# Performance: Explicitly runs without coverage
test-perf:
	TEST_USER_COUNT=$(or $(N),100) PERF_P95_THRESHOLD_MS=$(P95) npm run vitest -- --project=integration --reporter=verbose

emulator:
	firebase emulators:start

erd:
	node scripts/generate-erd.js

deploy-dev: build-dev
	. ./.env.development && firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting --project $$VITE_FIREBASE_PROJECT_ID --debug

deploy-prod: build-prod
	. ./.env.production && firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting --project $$VITE_FIREBASE_PROJECT_ID --debug
