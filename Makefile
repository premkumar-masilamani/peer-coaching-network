.PHONY: install
install:
	npm install
	git config core.hooksPath .githooks

.PHONY: lint
lint:
	npm run tsc && npm run eslint

.PHONY: build-dev
build-dev:
	npm run build:shared
	npm run pack:shared
	npm run build:functions
	set -a && . ./.env.development && set +a && npm run build --workspace=landing
	set -a && . ./.env.development && set +a && npm run build --workspace=web -- --mode production

.PHONY: build-prod
build-prod:
	npm run build:shared
	npm run pack:shared
	npm run build:functions
	set -a && . ./.env.production && set +a && npm run build --workspace=landing
	set -a && . ./.env.production && set +a && npm run build --workspace=web -- --mode production

.PHONY: run
run:
	npm run dev --workspace=web -- --mode development

.PHONY: landing
landing:
	npm run dev --workspace=landing

.PHONY: deploy-dev
deploy-dev: build-dev
	set -a && . ./.env.development && set +a && ./node_modules/.bin/firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting,functions --project $$VITE_FIREBASE_PROJECT_ID --debug

.PHONY: deploy-prod
deploy-prod: build-prod
	set -a && . ./.env.production && set +a && ./node_modules/.bin/firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting,functions --project $$VITE_FIREBASE_PROJECT_ID --debug

.PHONY: logs-dev
logs-dev:
	set -a && . ./.env.development && set +a && ./node_modules/.bin/firebase functions:log --project $$VITE_FIREBASE_PROJECT_ID $(if $(LINES),-n $(LINES),) $(if $(FUNC),--only $(FUNC),)

.PHONY: logs-prod
logs-prod:
	set -a && . ./.env.production && set +a && ./node_modules/.bin/firebase functions:log --project $$VITE_FIREBASE_PROJECT_ID $(if $(LINES),-n $(LINES),) $(if $(FUNC),--only $(FUNC),)

.PHONY: erd
erd:
	node scripts/generate-erd.js
