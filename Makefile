# Default variables for dynamic overrides
N ?= 3
P95 ?= 3000

.PHONY: install
install:
	npm install
	git config core.hooksPath .githooks

.PHONY: build_emulator
build_emulator:
	npm run build:shared
	npm run build:functions
	set -a && . ./web/.env.local && set +a && npm run build --workspace=web -- --mode production

.PHONY: build_dev
build_dev:
	npm run build:shared
	npm run build:functions
	set -a && . ./web/.env.development && set +a && npm run build --workspace=web -- --mode production

.PHONY: build_prod
build_prod:
	npm run build:shared
	npm run build:functions
	set -a && . ./web/.env.production && set +a && npm run build --workspace=web -- --mode production

.PHONY: dev
dev:
	npm run dev --workspace=web -- --mode development

.PHONY: local
local:
	npm run emulator:seed && npm run dev --workspace=web -- --mode development

.PHONY: lint
lint:
	npm run tsc && npm run eslint

.PHONY: emulator
emulator:
	$(MAKE) build_emulator
	firebase emulators:start

.PHONY: erd
erd:
	node scripts/generate-erd.js

.PHONY: deploy_dev
deploy_dev: build_dev
	. ./web/.env.development && firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting --project $$VITE_FIREBASE_PROJECT_ID --debug

.PHONY: deploy_prod
deploy_prod: build_prod
	. ./web/.env.production && firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting --project $$VITE_FIREBASE_PROJECT_ID --debug
