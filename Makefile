.PHONY: install run build lint clean emulator local erd test coverage

install:
	npm install

run:
	npm run dev

build:
	npm run build

lint:
	npm run lint

clean:
	rm -rf dist node_modules

emulator:
	firebase emulators:start

local:
	npm run local

erd:
	node scripts/generate-erd.js

test:
	npm run test

coverage:
	npm run coverage
