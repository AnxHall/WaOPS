-- Opaque event id (envelope contract owns event_id format: evt_...).
-- incident_events.event_id is a FK to events.id — both must change type together.

-- Drop FK that references events.id
ALTER TABLE "incident_events" DROP CONSTRAINT IF EXISTS "incident_events_event_id_fkey";

-- Alter FK column type on the referencing table
ALTER TABLE "incident_events" ALTER COLUMN "event_id" SET DATA TYPE TEXT;

-- Alter PK type on the referenced table
ALTER TABLE "events" DROP CONSTRAINT "events_pkey";
ALTER TABLE "events" ALTER COLUMN "id" SET DATA TYPE TEXT;
ALTER TABLE "events" ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");

-- Recreate FK against new type
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
