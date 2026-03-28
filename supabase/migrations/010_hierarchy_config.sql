-- Migration 010: Backfill hierarchy config into tree schemas
-- Adds hierarchy configuration to existing trees that don't have one.
-- Non-destructive: only updates trees where schema has no hierarchy key.

UPDATE skill_trees
SET schema = schema || '{
  "hierarchy": {
    "levels": [
      { "id": "stellar",   "label": "Stellar",   "render": "star" },
      { "id": "planet",    "label": "Planet",     "render": "planet" },
      { "id": "satellite", "label": "Satellite",  "render": "satellite" }
    ],
    "card_from": 1
  }
}'::jsonb
WHERE schema->>'hierarchy' IS NULL;
