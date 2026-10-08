UPDATE "CompetitionProfile"
SET "description" = REPLACE("description", 'official bid code', 'official partner code')
WHERE "description" LIKE '%official bid code%';
