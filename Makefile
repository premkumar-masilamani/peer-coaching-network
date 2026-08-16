.PHONY: install
install:
	npm install
	git config core.hooksPath .githooks

.PHONY: lint
lint:
	npm run tsc && npm run eslint

.PHONY: build_dev
build_dev:
	npm run build:shared
	npm pack --workspace=@pcn/shared --pack-destination=./functions
	npm run build:functions
	set -a && . ./.env.development && set +a && npm run build --workspace=web -- --mode production

.PHONY: run_dev
run_dev:
	npm run dev --workspace=web -- --mode development

.PHONY: deploy_dev
deploy_dev: build_dev
	. ./.env.development && firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting,functions --project $$VITE_FIREBASE_PROJECT_ID --debug

.PHONY: erd
erd:
	node scripts/generate-erd.js
