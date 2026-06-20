.PHONY: install build build-dev build-prod dev lint test coverage emulator local erd

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

coverage:
	npm run coverage

emulator:
	firebase emulators:start

local:
	npm run local

erd:
	node scripts/generate-erd.js
