-- Add playCount to Track
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "playCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "artistId" TEXT;

-- Create Artist table
CREATE TABLE IF NOT EXISTS "Artist" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bio" TEXT,
  "photoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Artist_name_key" ON "Artist"("name");

-- FK Track -> Artist
DO $$ BEGIN
  ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey"
    FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create Playlist table
CREATE TABLE IF NOT EXISTS "Playlist" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create PlaylistTrack table
CREATE TABLE IF NOT EXISTS "PlaylistTrack" (
  "playlistId" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("playlistId", "trackId")
);
CREATE INDEX IF NOT EXISTS "PlaylistTrack_playlistId_position_idx" ON "PlaylistTrack"("playlistId", "position");

DO $$ BEGIN
  ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_playlistId_fkey"
    FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_trackId_fkey"
    FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create ListenHistory table
CREATE TABLE IF NOT EXISTS "ListenHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "listenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListenHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ListenHistory_userId_listenedAt_idx" ON "ListenHistory"("userId", "listenedAt" DESC);
CREATE INDEX IF NOT EXISTS "ListenHistory_trackId_idx" ON "ListenHistory"("trackId");

DO $$ BEGIN
  ALTER TABLE "ListenHistory" ADD CONSTRAINT "ListenHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ListenHistory" ADD CONSTRAINT "ListenHistory_trackId_fkey"
    FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
