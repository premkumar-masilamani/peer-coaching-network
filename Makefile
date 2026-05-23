.PHONY: install run build lint clean

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
