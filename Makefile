.PHONY: install build dev lint test coverage emulator local erd

install:
	npm install

build:
	npm run build

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
