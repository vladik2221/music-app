import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import { prisma } from './prisma.js';
import { uploadToS3 } from './storage.js';
import os from 'os';
const MUSIC_DIR = process.argv[2] || process.env.MUSIC_DIR || './music';

async function findOrCreateArtist(name) {
  if (!name || name.trim() === '') return null;
  name = name.trim();
  const existing = await prisma.artist.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } }
  });
  if (existing) return existing;
  const created = await prisma.artist.create({ data: { name } });
  console.log(`  🎤 Новый артист: ${name}`);
  return created;
}

async function findOrCreateAlbum(albumTitle, artistId, year, coverPic) {
  if (!albumTitle || !artistId) return null;
  albumTitle = albumTitle.trim();

  const existing = await prisma.album.findFirst({
    where: {
      title: { equals: albumTitle, mode: 'insensitive' },
      artistId,
    }
  });
  if (existing) return existing;

  // Загружаем обложку альбома в S3
  let coverUrl = null;
  if (coverPic) {
    try {
      const coverExt = coverPic.format.includes('png') ? '.png' : '.jpg';
      const tmpId = `album_tmp_${Date.now()}`;
      const tmpCover = path.join(os.tmpdir(), `${tmpId}${coverExt}`);
      fs.writeFileSync(tmpCover, coverPic.data);
      const s3Key = `covers/${tmpId}${coverExt}`;
      await uploadToS3(tmpCover, s3Key, coverPic.format);
      coverUrl = s3Key;
    } catch (e) {
      console.log(`  ⚠️  Не удалось загрузить обложку альбома: ${e.message}`);
    }
  }

  const created = await prisma.album.create({
    data: { title: albumTitle, artistId, year: year || null, coverUrl }
  });
  console.log(`  💿 Новый альбом: ${albumTitle}${year ? ` (${year})` : ''}`);
  return created;
}

async function importTracks() {
  if (!fs.existsSync(MUSIC_DIR)) {
    console.error(`❌ Папка не найдена: ${MUSIC_DIR}`);
    console.error(`   Использование: node src/import-tracks.js "C:/Music/папка"`);
    process.exit(1);
  }

  const files = fs.readdirSync(MUSIC_DIR)
    .filter(f => /\.(mp3|m4a|flac|ogg|wav)$/i.test(f));

  if (files.length === 0) {
    console.log('📁 Аудио файлов не найдено в папке:', MUSIC_DIR);
    process.exit(0);
  }

  console.log(`📁 Найдено файлов: ${files.length} в папке: ${MUSIC_DIR}`);
  console.log('─'.repeat(50));

  let added = 0, skipped = 0, errors = 0;

  for (const file of files) {
    const filePath = path.join(MUSIC_DIR, file);
    console.log(`\n⏳ ${file}`);

    try {
      // Читаем ID3 теги
      const meta = await mm.parseFile(filePath);
      const tags = meta.common;

      const title = (tags.title || path.basename(file, path.extname(file))).trim();
      const artistName = tags.artist || tags.albumartist || null;
      const albumTitle = tags.album || null;
      const year = tags.year || null;
      const durationSec = Math.round(meta.format.duration || 0);

      console.log(`   Название: ${title}`);
      console.log(`   Артист:   ${artistName || '—'}`);
      console.log(`   Альбом:   ${albumTitle || '—'}${year ? ` (${year})` : ''}`);

      // Пропускаем дубли
      const exists = await prisma.track.findFirst({
        where: {
          title: { equals: title, mode: 'insensitive' },
          artist: { equals: artistName, mode: 'insensitive' }
        }
      });
      if (exists) {
        console.log(`  ⏭️  Уже есть в базе — пропускаю`);
        skipped++;
        continue;
      }

      // Создаём артиста
      const artist = await findOrCreateArtist(artistName);

      // Создаём альбом
      const album = artist
        ? await findOrCreateAlbum(albumTitle, artist.id, year, tags.picture?.[0])
        : null;

      // Создаём трек в БД
      const track = await prisma.track.create({
        data: {
          title,
          artist: artistName,
          artistId: artist?.id || null,
          albumId: album?.id || null,
          durationSec,
          isPublished: false,
        }
      });

      // Загружаем MP3 в S3
      const ext = path.extname(file);
      const tmpAudio = path.join(os.tmpdir(), `audio_${track.id}${ext}`);
      fs.copyFileSync(filePath, tmpAudio);
      const s3AudioKey = `audio/${track.id}${ext}`;
      await uploadToS3(tmpAudio, s3AudioKey, 'audio/mpeg');
      await prisma.track.update({
        where: { id: track.id },
        data: { filePath: s3AudioKey }
      });
      console.log(`  ✅ Аудио загружено в S3`);

      // Загружаем обложку трека из тегов
      if (tags.picture?.length > 0) {
        try {
          const pic = tags.picture[0];
          const coverExt = pic.format.includes('png') ? '.png' : '.jpg';
          const tmpCover = path.join(os.tmpdir(), `cover_${track.id}${coverExt}`);
          fs.writeFileSync(tmpCover, pic.data);
          const s3CoverKey = `covers/${track.id}_cover${coverExt}`;
          await uploadToS3(tmpCover, s3CoverKey, pic.format);
          await prisma.track.update({
            where: { id: track.id },
            data: { coverUrl: s3CoverKey }
          });
          console.log(`  🖼️  Обложка загружена`);

          // Если у артиста ещё нет фото — берём обложку трека
          if (artist && !artist.photoUrl) {
            const tmpArtistPhoto = path.join(os.tmpdir(), `artist_${artist.id}${coverExt}`);
            fs.writeFileSync(tmpArtistPhoto, pic.data);
            const s3ArtistKey = `artists/${artist.id}_photo${coverExt}`;
            await uploadToS3(tmpArtistPhoto, s3ArtistKey, pic.format);
            await prisma.artist.update({
              where: { id: artist.id },
              data: { photoUrl: s3ArtistKey }
            });
            console.log(`  🎤 Фото артиста установлено`);
          }
        } catch (e) {
          console.log(`  ⚠️  Ошибка обложки: ${e.message}`);
        }
      }

      // Публикуем трек
      await prisma.track.update({
        where: { id: track.id },
        data: { isPublished: true }
      });

      console.log(`  🎵 Добавлен: ${artistName || '—'} — ${title}`);
      added++;

    } catch (e) {
      console.error(`  ❌ Ошибка: ${e.message}`);
      errors++;
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`📊 Готово!`);
  console.log(`   ✅ Добавлено:  ${added}`);
  console.log(`   ⏭️  Пропущено: ${skipped}`);
  console.log(`   ❌ Ошибок:    ${errors}`);

  const artistCount = await prisma.artist.count();
  const albumCount = await prisma.album.count();
  const trackCount = await prisma.track.count({ where: { isPublished: true } });
  console.log(`\n📈 Итого в базе: ${trackCount} треков · ${albumCount} альбомов · ${artistCount} артистов`);

  await prisma.$disconnect();
}

importTracks();
