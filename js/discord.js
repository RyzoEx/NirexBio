/**
 * Discord Integration через Lanyard API
 * https://api.lanyard.rest/v1/users/{userId}
 *
 * Lanyard — публичный API, парсит данные Discord в реальном времени:
 *   - Аватар, имя пользователя, дискриминатор
 *   - Статус (online / idle / dnd / offline)
 *   - Кастомный статус (текст + эмодзи)
 *   - Текущая активность (игра, Spotify и т.д.)
 *
 * Для работы нужно:
 *   1. Зайти на сервер Lanyard: https://discord.gg/lanyard
 *   2. Указать свой Discord User ID в config.js → discord.userId
 *   3. Поставить discord.useDiscord: true
 */
class DiscordIntegration {
  constructor(config) {
    this.config = config.discord || {};
    this.userData = config.user || {};

    if (!this.config.useDiscord || !this.config.userId) {
      return;
    }

    this.apiUrl = `https://api.lanyard.rest/v1/users/${this.config.userId}`;
    this.statusColors = {
      online: "#22c55e",
      idle: "#f59e0b",
      dnd: "#ef4444",
      offline: "#6b7280"
    };

    this.fetch();
    // Обновлять каждые 30 секунд
    this.interval = setInterval(() => this.fetch(), 30000);
  }

  async fetch() {
    try {
      const response = await window.fetch(this.apiUrl);
      if (!response.ok) {
        console.warn("[Discord] Lanyard API error:", response.status);
        return;
      }

      // Защита от Cloudflare challenge (отдаёт HTML вместо JSON)
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        console.warn("[Discord] Lanyard вернул не JSON (возможно Cloudflare challenge), пропускаем");
        return;
      }

      const json = await response.json();
      if (!json.success || !json.data) {
        console.warn("[Discord] No data from Lanyard");
        return;
      }

      this.apply(json.data);
    } catch (err) {
      console.warn("[Discord] Fetch failed:", err.message);
    }
  }

  apply(data) {
    const user = data.discord_user;
    if (!user) return;

    // ─── Аватар ───
    if (this.config.fetchAvatar !== false) {
      const avatarHash = user.avatar;
      const avatarEl = document.getElementById("profile-avatar");
      if (avatarHash && avatarEl) {
        const ext = avatarHash.startsWith("a_") ? "gif" : "png";
        const url = `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.${ext}?size=256`;
        avatarEl.src = url;
      }
    }

    // ─── Имя пользователя ───
    const nameEl = document.getElementById("profile-name");
    if (nameEl && user.global_name) {
      // Показываем global_name, если он есть, иначе username
      nameEl.textContent = user.global_name || user.username;
    }

    const handleEl = document.getElementById("profile-handle");
    if (handleEl && user.username) {
      handleEl.textContent = `@${user.username}`;
    }

    // ─── Статус (online/idle/dnd/offline) ───
    if (this.config.fetchStatus !== false) {
      const statusDot = document.querySelector(".status-indicator-dot");
      if (statusDot) {
        const status = data.discord_status || "offline";
        const color = this.statusColors[status] || this.statusColors.offline;
        statusDot.style.backgroundColor = color;
        statusDot.style.boxShadow = `0 0 8px ${color}`;
        statusDot.title = `Discord: ${status}`;
      }
    }

    // ─── Кастомный статус → Био ───
    if (this.config.fetchBio) {
      const bioEl = document.getElementById("profile-bio");
      if (bioEl && data.activities) {
        const customStatus = data.activities.find(a => a.type === 4);
        if (customStatus) {
          let bioText = "";
          if (customStatus.emoji && customStatus.emoji.name) {
            bioText += customStatus.emoji.name + " ";
          }
          if (customStatus.state) {
            bioText += customStatus.state;
          }
          if (bioText.trim()) {
            bioEl.textContent = bioText.trim();
          }
        }
      }
    }

    // ─── Акцент-цвет профиля Discord → CSS переменные ───
    if (this.config.useDiscordColors) {
      this.applyAccentColor(user);
    }

    // ─── Текущая активность (игра / Spotify) ───
    if (this.config.fetchActivity) {
      this.applyActivity(data);
    }
  }

  /**
   * Берёт accent_color / banner_color из Discord и переопределяет
   * CSS-переменные: --accent-purple, --accent-cyan, --accent-glow, --accent-gradient
   */
  applyAccentColor(user) {
    // accent_color — целое число (decimal), banner_color — hex строка
    const accentInt = user.accent_color;
    const bannerHex = user.banner_color;

    let hexColor = null;

    if (accentInt != null && accentInt !== 0) {
      // Конвертировать decimal → hex (#RRGGBB)
      hexColor = "#" + accentInt.toString(16).padStart(6, "0");
    } else if (bannerHex) {
      hexColor = bannerHex;
    }

    if (!hexColor) return;

    // Из основного цвета генерируем вторичный (сдвиг по hue на +40°)
    const hsl = this.hexToHSL(hexColor);
    const secondaryHSL = { h: (hsl.h + 40) % 360, s: hsl.s, l: hsl.l };
    const midHSL = { h: (hsl.h + 20) % 360, s: Math.min(hsl.s + 10, 100), l: hsl.l };

    const primary = hexColor;
    const secondary = `hsl(${secondaryHSL.h}, ${secondaryHSL.s}%, ${secondaryHSL.l}%)`;
    const mid = `hsl(${midHSL.h}, ${midHSL.s}%, ${midHSL.l}%)`;

    const root = document.documentElement;

    // Основные акценты
    root.style.setProperty("--accent-purple", primary);
    root.style.setProperty("--accent-cyan", secondary);
    root.style.setProperty("--accent-glow", this.hexToRGBA(hexColor, 0.4));
    root.style.setProperty("--accent-gradient", `linear-gradient(135deg, ${primary}, ${mid}, ${secondary})`);

    // Тень карточки с новым цветом
    root.style.setProperty("--card-shadow",
      `0 20px 50px rgba(0, 0, 0, 0.65), 0 0 40px ${this.hexToRGBA(hexColor, 0.12)}`
    );

    console.log(`[Discord] Accent color applied: ${hexColor}`);
  }

  // Hex → HSL конвертер
  hexToHSL(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // Hex → rgba() строка
  hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  applyActivity(data) {
    // Spotify трек из Lanyard
    if (data.listening_to_spotify && data.spotify) {
      const sp = data.spotify;
      const titleEl = document.getElementById("track-title");
      const artistsEl = document.getElementById("track-artists");
      const coverEl = document.getElementById("track-cover");
      const playerWidget = document.getElementById("player-widget");

      if (titleEl) titleEl.textContent = sp.song || "Unknown Track";

      if (artistsEl) {
        artistsEl.innerHTML = "";
        const link = document.createElement("a");
        link.className = "track-artist-link";
        link.href = "#";
        link.textContent = sp.artist || "Unknown Artist";
        artistsEl.appendChild(link);
      }

      if (coverEl && sp.album_art_url) {
        coverEl.src = sp.album_art_url;
      }

      // Показать плеер если есть Spotify активность
      if (playerWidget) {
        playerWidget.style.display = "";
        playerWidget.classList.remove("player-disabled");
      }

      return;
    }

    // Игра или другая активность
    const activities = data.activities || [];
    const gameActivity = activities.find(a => a.type === 0); // Playing
    if (gameActivity) {
      const titleEl = document.getElementById("track-title");
      const artistsEl = document.getElementById("track-artists");

      if (titleEl) titleEl.textContent = `🎮 ${gameActivity.name}`;
      if (artistsEl) {
        artistsEl.innerHTML = "";
        const span = document.createElement("span");
        span.className = "track-artist-link";
        span.textContent = gameActivity.details || gameActivity.state || "In Game";
        artistsEl.appendChild(span);
      }
    }
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
  }
}

window.DiscordIntegration = DiscordIntegration;
