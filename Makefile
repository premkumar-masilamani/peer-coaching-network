.PHONY: install run build lint clean emulator local

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
	firebase emulators:exec "npm run local"