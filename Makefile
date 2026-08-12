.PHONY: install
install:
	npm install
	git config core.hooksPath .githooks

.PHONY: lint
lint:
	npm run tsc && npm run eslint

.PHONY: build_emulator
build_emulator:
	npm run build:shared
	npm run build:functions
	set -a && . ./.env.local && set +a && npm run build --workspace=web -- --mode production

.PHONY: emulator
emulator:
	$(MAKE) build_emulator
	set -a && . ./.env.local && set +a && firebase emulators:start

.PHONY: local
local:
	npm run emulator:seed && npm run dev --workspace=web -- --mode development

.PHONY: build_dev
build_dev:
	npm run build:shared
	npm run build:functions
	set -a && . ./.env.development && set +a && npm run build --workspace=web -- --mode production

.PHONY: dev
dev:
	npm run dev --workspace=web -- --mode development

.PHONY: build
build: build_emulator

.PHONY: deploy_dev
deploy_dev: build_dev
	. ./.env.development && firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting,functions --project $$VITE_FIREBASE_PROJECT_ID --debug

.PHONY: erd
erd:
	node scripts/generate-erd.js
