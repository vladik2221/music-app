#!/usr/bin/env python3
"""
Импорт треков из Яндекс Музыки через hitmotop.com

Установка зависимостей:
    pip install yandex-music requests beautifulsoup4 mutagen

Использование:
    YANDEX_TOKEN=ваш_токен python3 yandex_import.py

    # Или с явным токеном:
    python3 yandex_import.py --token ВАШ_ТОКЕН --output ./tracks --limit 50
"""

import os
import re
import sys
import time
import argparse
import requests
from pathlib import Path
from bs4 import BeautifulSoup

try:
    from yandex_music import Client
except ImportError:
    print("❌ Установи зависимости: pip install yandex-music requests beautifulsoup4")
    sys.exit(1)

# ── Настройки ──────────────────────────────────────────────────────────────────

HITMOTOP_SEARCH = "https://rus.hitmotop.com/search?q={query}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Referer": "https://rus.hitmotop.com/",
}

# ── Получение медиатеки ────────────────────────────────────────────────────────

def get_liked_tracks(token):
    print("🔑 Подключаемся к Яндекс Музыке...")
    client = Client(token).init()
    print(f"✅ Авторизован как: {client.me.account.full_name}")

    print("📚 Загружаем медиатеку...")
    liked = client.users_likes_tracks()
    tracks = []
    for item in liked:
        try:
            track = item.fetch_track()
            artists = ", ".join(a.name for a in track.artists) if track.artists else ""
            title = track.title or ""
            if title:
                tracks.append({"title": title, "artist": artists})
        except Exception as e:
            pass

    print(f"📀 Найдено треков в медиатеке: {len(tracks)}")
    return tracks

# ── Поиск на hitmotop.com ──────────────────────────────────────────────────────

def search_hitmotop(artist, title, session):
    query = f"{artist} {title}".strip()
    url = HITMOTOP_SEARCH.format(query=requests.utils.quote(query))

    try:
        r = session.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
    except Exception as e:
        print(f"  ⚠️  Ошибка запроса: {e}")
        return None

    soup = BeautifulSoup(r.text, "html.parser")

    # Ищем ссылку на скачивание mp3
    # hitmotop обычно хранит ссылки в атрибутах data-url или href заканчивающихся на .mp3
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.endswith(".mp3") or "download" in a.get("class", []):
            return href if href.startswith("http") else f"https://rus.hitmotop.com{href}"

    # Запасной вариант — ищем data-url у кнопок скачивания
    for el in soup.find_all(attrs={"data-url": True}):
        data_url = el["data-url"]
        if ".mp3" in data_url:
            return data_url if data_url.startswith("http") else f"https://rus.hitmotop.com{data_url}"

    return None

# ── Скачивание файла ───────────────────────────────────────────────────────────

def download_mp3(url, dest_path, session):
    try:
        r = session.get(url, headers=HEADERS, stream=True, timeout=60)
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"  ❌ Ошибка скачивания: {e}")
        return False

# ── Безопасное имя файла ───────────────────────────────────────────────────────

def safe_filename(artist, title):
    name = f"{artist} - {title}" if artist else title
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = name.strip()[:200]
    return f"{name}.mp3"

# ── Основной цикл ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Импорт треков из Яндекс Музыки через hitmotop.com")
    parser.add_argument("--token", default=os.environ.get("YANDEX_TOKEN", ""), help="Токен Яндекс Музыки")
    parser.add_argument("--output", default="./tracks", help="Папка для сохранения треков (по умолчанию: ./tracks)")
    parser.add_argument("--limit", type=int, default=0, help="Максимальное количество треков (0 = все)")
    parser.add_argument("--delay", type=float, default=1.5, help="Пауза между запросами в секундах (по умолчанию: 1.5)")
    args = parser.parse_args()

    if not args.token:
        print("❌ Укажи токен: --token ВАШ_ТОКЕН или переменную YANDEX_TOKEN")
        print("\nКак получить токен:")
        print("  Открой в браузере:")
        print("  https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d")
        print("  Авторизуйся и скопируй access_token из URL")
        sys.exit(1)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Получаем медиатеку
    tracks = get_liked_tracks(args.token)
    if args.limit > 0:
        tracks = tracks[:args.limit]
        print(f"🔢 Ограничение: первые {args.limit} треков")

    print(f"\n📁 Сохраняем в: {output_dir.resolve()}")
    print("─" * 50)

    session = requests.Session()
    downloaded = 0
    skipped = 0
    not_found = 0
    errors = 0

    for i, track in enumerate(tracks, 1):
        artist = track["artist"]
        title = track["title"]
        label = f"{artist} — {title}" if artist else title
        filename = safe_filename(artist, title)
        dest = output_dir / filename

        print(f"\n[{i}/{len(tracks)}] {label}")

        # Пропускаем если уже скачан
        if dest.exists():
            print(f"  ⏭️  Уже есть — пропускаю")
            skipped += 1
            continue

        # Ищем на hitmotop
        mp3_url = search_hitmotop(artist, title, session)
        if not mp3_url:
            print(f"  🔍 Не найдено на hitmotop")
            not_found += 1
            time.sleep(args.delay)
            continue

        print(f"  🔗 Нашли: {mp3_url[:80]}...")
        if download_mp3(mp3_url, dest, session):
            print(f"  ✅ Скачано: {filename}")
            downloaded += 1
        else:
            errors += 1

        time.sleep(args.delay)

    print("\n" + "─" * 50)
    print(f"📊 Готово!")
    print(f"   ✅ Скачано:    {downloaded}")
    print(f"   ⏭️  Пропущено: {skipped}")
    print(f"   🔍 Не найдено: {not_found}")
    print(f"   ❌ Ошибок:    {errors}")
    print(f"\n📁 Треки в папке: {output_dir.resolve()}")
    print(f"\n🚀 Следующий шаг — импорт в приложение:")
    print(f"   cd /var/www/music-app/backend")
    print(f"   node node_modules/prisma/build/index.js db push  # если нужно")
    print(f"   node src/import-tracks.js {output_dir.resolve()}")

if __name__ == "__main__":
    main()
