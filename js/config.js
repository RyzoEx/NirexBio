/**
 * Конфигурация Bio-Профиля
 * Guns.lol Clone / Bio Link Page
 *
 * ВСЕ НАСТРОЙКИ ПРОФИЛЯ, КАРТОЧКИ, ЭФФЕКТОВ И DISCORD ИНТЕГРАЦИИ ЗДЕСЬ.
 * Просто меняй значения и обновляй страницу.
 */
const PROFILE_CONFIG = {

  // ═══════════════════════════════════════════════════════════
  //  ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ
  // ═══════════════════════════════════════════════════════════
  user: {
    name: "nirex // 尼雷克斯",        // Имя / Никнейм (отображается как H1)
    handle: "@nekorimnas",              // Хендл / тег (под никнеймом)
    statusBadge: "VERIFIED",            // Текст бейджа статуса
    avatar: "assets/avatar.jpg",        // Путь к аватару (JPG/PNG/WebP/GIF). Если useDiscord: true — подтянется из Discord
    bio: "Junior Software Engineer",    // Био / описание. Если useDiscord: true — подтянется из Discord
    registered: "Member since Oct 2026 • UID: #1901", // Дата регистрации / доп. инфо
    location: "Ivano-Frankivsk, Ukraine",              // Геолокация
    views: "0",                         // Счётчик просмотров

    // Бейджи рядом с никнеймом (SVG иконки)
    badges: [
      { id: "verified", name: "Verified Profile", icon: "verified" },
      { id: "booster", name: "Nitro Booster", icon: "booster" },
      { id: "diamond", name: "VIP Patron", icon: "diamond" },
      { id: "developer", name: "Developer", icon: "code" }
    ],

    // Социальные сети (SVG иконки, клик копирует тег в буфер обмена)
    socials: [
      { name: "Discord", url: "https://discord.com", icon: "discord", tag: "bvlletwoundntx" },
      { name: "Telegram", url: "https://t.me", icon: "telegram", tag: "---" },
      { name: "GitHub", url: "https://github.com/RyzoEx", icon: "github", tag: "RyzoEx" },
      { name: "Spotify", url: "https://open.spotify.com/user/313ja3mlsyzhiv3h7ula6pho7lhi?si=0bbcd07507ba4c26", icon: "spotify", tag: "Spotify" },
      { name: "Steam", url: "https://steamcommunity.com/id/notnoptixv4/", icon: "steam", tag: "notnoptixv4" },
      { name: "Twitter/X", url: "https://x.com", icon: "twitter", tag: "---" }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  //  DISCORD ИНТЕГРАЦИЯ (Lanyard API)
  //  Используется публичный API https://api.lanyard.rest
  //  Для работы нужно присоединиться к серверу Lanyard: https://discord.gg/lanyard
  // ═══════════════════════════════════════════════════════════
  discord: {
    useDiscord: true,      // true = подтягивать данные из Discord, false = использовать user.* выше
    userId: "1176237516169429062",             // Твой Discord User ID (число). Пример: "394820776781955072"

    // Что именно подтягивать из Discord (если useDiscord: true):
    fetchAvatar: true,      // Подтянуть аватар из Discord (заменит user.avatar)
    fetchStatus: true,      // Подтянуть статус (online/idle/dnd/offline) и показать индикатор
    fetchBio: true,         // Подтянуть кастомный статус Discord как био (заменит user.bio)
    fetchActivity: true,    // Подтянуть текущую активность (игра, Spotify) и показать в плеере
    useDiscordColors: true // true = акцент-цвет из Discord профиля → подсветка карточки, false = без подсветки
  },

  // ═══════════════════════════════════════════════════════════
  //  ФОН И ЗВУК (Приоритет аудио)
  //  Сценарий А: audioSrc задан → видео глушится, плеер управляет MP3
  //  Сценарий Б: audioSrc = null + bgType = "video" → звук из видео
  //  Сценарий В: audioSrc = null + bgType = "image"/"gif" → плеер неактивен
  // ═══════════════════════════════════════════════════════════
  activeScenario: "scenarioA",

  scenarios: {
    scenarioA: {
      id: "scenarioA",
      label: "...black...",
      description: "...",
      bgType: "video",              // "image" | "video" | "gif"
      bgSrc: "assets/video.mp4",    // Путь к фоновому видео/картинке/GIF
      audioSrc: "assets/audio.mp3", // Первый (основной) трек. null = звук из видео

      // ═══════════════════════════════════════════════════════════
      //  ПЛЕЙЛИСТ (Массив треков с кроссфейдом)
      //  Если playlist не пуст — система автоматически проверяет наличие файлов
      //  audio2.mp3, audio3.mp3 и т.д. и играет их последовательно
      //  с плавным fade out → fade in переходом между треками.
      //  crossfadeDuration — длительность перехода (fade) в секундах.
      // ═══════════════════════════════════════════════════════════
      crossfadeDuration: 2.5,       // Длительность кроссфейда (fade out → fade in) в секундах

      // Массив треков (первый = audioSrc выше). Добавь сюда audio2.mp3, audio3.mp3 и т.д.
      // Система автоматически обнаружит файлы assets/audio2.mp3, assets/audio3.mp3 и добавит их.
      // Но если хочешь указать кастомные названия/обложки — пропиши вручную:
      playlist: [
        // Трек 1 (основной, берётся из audioSrc автоматически)
        {
          src: "assets/audio.mp3",
          title: "MR ROBOT",
          artists: [
            { name: "...", url: "#" },
            { name: "...", url: "#" }
          ],
          cover: "assets/album.jpg"
        }
        // Трек 2, 3, ... будут обнаружены автоматически (audio2.mp3, audio3.mp3)
        // Или добавь вручную:
        // {
        //   src: "assets/audio2.mp3",
        //   title: "Track 2",
        //   artists: [{ name: "Artist", url: "#" }],
        //   cover: "assets/album2.jpg"
        // }
      ],

      track: {
        title: "MR ROBOT",
        artists: [
          { name: "...", url: "#" },
          { name: "...", url: "#" }
        ],
        cover: "assets/album.jpg",
        duration: 172
      }
    },

    scenarioB: {
      id: "scenarioB",
      label: "Сценарий Б: Звук из фонового видео",
      description: "Отдельный звук отсутствует. Плеер напрямую управляет звуковой дорожкой фонового видео.",
      bgType: "video",
      bgSrc: "assets/video.mp4",
      audioSrc: null,
      track: {
        title: "Cyber Ambient Soundscape",
        artists: [{ name: "Direct Video Stream", url: "#" }],
        cover: "assets/album.jpg",
        duration: 0
      }
    },

    scenarioC: {
      id: "scenarioC",
      label: "Сценарий В: Фото/GIF без звука",
      description: "Статичный фон и отсутствие звука. Медиаплеер переходит в режим ожидания (неактивен).",
      bgType: "image",
      bgSrc: "assets/background.jpg",
      audioSrc: null,
      track: null
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  НАСТРОЙКИ КАРТОЧКИ
  // ═══════════════════════════════════════════════════════════
  card: {
    bgOpacity: 0.45,      // Прозрачность фона карточки (0 = полностью прозрачная, 1 = полностью непрозрачная)
    bgBlur: 16,           // Размытие за карточкой в px (0 = без размытия, 16 = стандарт, 32 = сильное)
    borderRadius: 22,     // Скругление углов карточки в px
    borderOpacity: 0.1,   // Прозрачность рамки карточки (0–1)
    padding: 24           // Внутренние отступы карточки в px
  },

  // ═══════════════════════════════════════════════════════════
  //  ВИЗУАЛЬНЫЕ ЭФФЕКТЫ
  // ═══════════════════════════════════════════════════════════
  effects: {
    particles: false,               // true = включить летящие частицы на фоне, false = отключить
    tiltMaxAngle: 12,               // Максимальный угол 3D наклона карточки (10–15 градусов)
    tiltGlare: true,                // true = стеклянный блик при наклоне
    tiltMaxGlare: 0.22,             // Максимальная яркость блика (0–1)
    customCursor: true,             // true = кастомный курсор из файла, false = стандартный
    cursorImage: "assets/cursor.gif", // Путь к картинке курсора (.gif/.png/.webp/.svg, поддерживает анимированные GIF)
    cursorSize: 28,                 // Фиксированный размер курсора в px (любое разрешение масштабируется)
    audioVisualizer: true,          // true = анимация эквалайзера при воспроизведении
    showPlayer: false,              // true = показать виджет плеера на карточке, false = скрыть
    randomFirstTrack: true,         // true = случайный выбор первого трека при открытии (shuffle), false = всегда начинать с 1-го

    // ═══════════════════════════════════════════════════════════
    //  CAM SHAKE / ТРЯСКА ПОД БИТ (в стиле MusicVid.org)
    //  Плавное качание камеры под бочку и бас через Web Audio API.
    //  Использует физический пружинный амортизатор (damped spring),
    //  устраняя резкую вибрацию и дребезг.
    // ═══════════════════════════════════════════════════════════
    makeCamShake: true,            // true = включить качание камеры под бит, false = отключить
    camShakeIntensity: 5,           // Position Shake: макс. смещение камеры в px (3 = мягко, 5 = сбалансированно, 8 = сильно)
    camShakeRotation: 0.35,         // Rotation Amount: наклон камеры в градусах при ударе баса (0.2°–0.6°)
    camShakeScale: 0.012,           // Bass Pulse: легкий импульс зума под бочку (0.012 = 1.2% зум)
    camShakeSensitivity: 0.60,      // Audio Reactivity (0.0–1.0): порог срабатывания (выше = только сильные удары бочки)
    camShakeSmoothing: 0.89,        // Audio Smoothing (0.7–0.95): сглаживание аудиосигнала как в MusicVid (выше = мягче)
    camShakeBpm: 128                // BPM трека (120–135): ритм качания при открытии напрямую через file://
  }
};
