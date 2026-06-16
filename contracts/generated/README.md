# contracts/generated — JANGAN EDIT MANUAL

Output `make contracts` dari `contracts/events.schema.json`.
Di-commit biar build tak butuh generator, tapi selalu regenerate dari schema.

| Bahasa | Tool | Target servis |
|---|---|---|
| Python (Pydantic v2) | `datamodel-code-generator` | `engine/app/contracts/events.py` |
| TypeScript | `json-schema-to-typescript` | `web/lib/contracts/events.ts` |
| Go | `go-jsonschema` | `gateway/internal/contracts/events.go` |
