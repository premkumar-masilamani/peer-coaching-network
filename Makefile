.PHONY: install build build-dev build-prod dev lint test test\:integration test\:perf coverage emulator local seed erd deploy-dev deploy-prod

install:
	npm install

build:
	npm run build:dev

build-dev:
	npm run build:dev

build-prod:
	npm run build:prod

dev:
	npm run dev

lint:
	npm run lint

test:
	npm run test

test\:integration:
	TEST_USER_COUNT=$(or $(N),3) npm run test:integration

test\:perf:
	TEST_USER_COUNT=$(or $(N),100) PERF_P95_THRESHOLD_MS=$(or $(P95),3000) npm run test:perf

coverage:
	npm run coverage

emulator:
	npx firebase emulators:start

local:
	node scripts/seed-emulator.cjs && npm run local

seed:
	node scripts/seed-emulator.cjs

erd:
	node scripts/generate-erd.js

deploy-dev: build-dev
	. ./.env.development && npx firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting --project $$VITE_FIREBASE_PROJECT_ID --debug

deploy-prod: build-prod
	. ./.env.production && npx firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting --project $$VITE_FIREBASE_PROJECT_ID --debug
