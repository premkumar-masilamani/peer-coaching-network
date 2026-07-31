# Default variables for dynamic overrides
N ?= 3
P95 ?= 3000

.PHONY: install
install:
	npm install
	git config core.hooksPath .githooks

.PHONY: build_dev
build_dev:
	set -a && . ./.env.development && set +a && npm run tsc && npm run vite -- build --mode production

.PHONY: build_prod
build_prod:
	set -a && . ./.env.production && set +a && npm run tsc && npm run vite -- build --mode production

.PHONY: dev
dev:
	npm run vite -- --mode development

.PHONY: local
local:
	npm run emulator:seed && npm run vite -- --mode development

.PHONY: lint
lint:
	npm run tsc && npm run eslint

.PHONY: unit_test
unit_test:
	npm run vitest -- --project=unit --coverage

.PHONY: integration_test
integration_test:
	TEST_USER_COUNT=$(N) npm run vitest -- --project=integration --coverage

.PHONY: performance_test
performance_test:
	TEST_USER_COUNT=$(or $(N),100) PERF_P95_THRESHOLD_MS=$(P95) npm run vitest -- --project=integration --reporter=verbose

.PHONY: emulator
emulator:
	firebase emulators:start

.PHONY: erd
erd:
	node scripts/generate-erd.js

.PHONY: deploy_dev
deploy_dev: build_dev
	. ./.env.development && firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting --project $$VITE_FIREBASE_PROJECT_ID --debug

.PHONY: deploy_prod
deploy_prod: build_prod
	. ./.env.production && firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting --project $$VITE_FIREBASE_PROJECT_ID --debug
