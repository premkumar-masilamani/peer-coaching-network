.PHONY: install
install:
	npm install
	git config core.hooksPath .githooks

.PHONY: lint
lint:
	npm run tsc && npm run eslint

.PHONY: build
build:
	npm run build:shared
	npm run pack:shared
	npm run build:functions
	npm run build --workspace=landing
	set -a && . ./.env.development && set +a && npm run build --workspace=web -- --mode production

.PHONY: run
run:
	npm run dev --workspace=web -- --mode development

.PHONY: run-landing
run-landing:
	npm run dev --workspace=landing

.PHONY: deploy
deploy: build
	set -a && . ./.env.development && set +a && npx --no-install firebase deploy --only firestore:$$VITE_FIRESTORE_DATABASE_ID,hosting,functions --project $$VITE_FIREBASE_PROJECT_ID --debug

.PHONY: logs
logs:
	set -a && . ./.env.development && set +a && npx --no-install firebase functions:log --project $$VITE_FIREBASE_PROJECT_ID $(if $(LINES),-n $(LINES),) $(if $(FUNC),--only $(FUNC),)

.PHONY: erd
erd:
	node scripts/generate-erd.js
