.PHONY: up down dev logs migrate makemigration contracts introspect seed fmt

up:                ## nyalakan semua servis
	docker compose up -d

down:
	docker compose down

dev:               ## up + ikuti log
	docker compose up

logs:
	docker compose logs -f

migrate:           ## jalankan migration (Alembic)
	docker compose exec engine alembic upgrade head

makemigration:     ## buat migration baru: make makemigration m="add contacts"
	docker compose exec engine alembic revision --autogenerate -m "$(m)"

contracts:         ## generate tipe event ke 3 bahasa dari events.schema.json
	datamodel-codegen --input contracts/events.schema.json --input-file-type jsonschema \
	  --output-model-type pydantic_v2.BaseModel --output engine/app/contracts/events.py
	npx json-schema-to-typescript contracts/events.schema.json -o web/lib/contracts/events.ts
	go-jsonschema -p contracts contracts/events.schema.json > gateway/internal/contracts/events.go

introspect:        ## sinkron skema Drizzle dari DB (setelah migrate)
	docker compose exec web npx drizzle-kit pull

seed:
	docker compose exec engine python -m app.seed

fmt:               ## format semua servis
	docker compose exec engine ruff format .
	docker compose exec web npm run format
	cd gateway && gofmt -w .
