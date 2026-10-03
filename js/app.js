/**
 * Main Application Orchestrator
 */
document.addEventListener("DOMContentLoaded", () => {
  // 1. Частицы на фоне
  let particleBg = null;
  if (PROFILE_CONFIG.effects.particles) {
    particleBg = new ParticleBackground("particles-canvas");
  }

  // 2. Менеджер медиа (сценарии A, B, C)
  const mediaManager = new MediaManager(PROFILE_CONFIG);
  if (PROFILE_CONFIG.effects && PROFILE_CONFIG.effects.showPlayer === false) {
    const pw = document.getElementById("player-widget");
    if (pw) pw.style.display = "none";
  }

  // 3. Применить настройки карточки из конфига (прозрачность, размытие и т.д.)
  applyCardSettings(PROFILE_CONFIG);

  // 4. 3D Tilt с бликом
  const profileCard = document.getElementById("profile-card");
  let cardTilt = null;
  if (profileCard) {
    cardTilt = new CardTilt(profileCard, {
      maxAngle: PROFILE_CONFIG.effects.tiltMaxAngle,
      glare: PROFILE_CONFIG.effects.tiltGlare,
      maxGlare: PROFILE_CONFIG.effects.tiltMaxGlare,
      depth: true
    });
  }

  // 5. Кастомный GIF/PNG курсор
  let customCursor = null;
  if (PROFILE_CONFIG.effects.customCursor) {
    customCursor = new CustomCursor({
      image: PROFILE_CONFIG.effects.cursorImage || "assets/cursor.gif",
      size: PROFILE_CONFIG.effects.cursorSize || 28
    });
  }

  // 6. Заполнить данные профиля из конфига
  populateProfileData(PROFILE_CONFIG);

  // 7. Discord интеграция (Lanyard API)
  let discordIntegration = null;
  if (PROFILE_CONFIG.discord && PROFILE_CONFIG.discord.useDiscord) {
    discordIntegration = new DiscordIntegration(PROFILE_CONFIG);
  }

  // 8. Оверлей "click anywhere to enter" (guns.lol стиль)
  const enterOverlay = document.getElementById("enter-overlay");
  let hasEntered = false;

  const handleEnter = () => {
    if (hasEntered) return;
    hasEntered = true;

    // 1. Оверлей плавно исчезает
    enterOverlay.classList.add("overlay-hidden");
    setTimeout(() => {
      enterOverlay.style.display = "none";
    }, 800);

    // 2. Карточка раскрывается как конверт (с задержкой после fade оверлея)
    const card = document.getElementById("profile-card");
    if (card) {
      setTimeout(() => {
        card.classList.remove("card-hidden");
        card.classList.add("card-revealing");

        // Убрать класс анимации после завершения (чтобы не мешал tilt)
        card.addEventListener("animationend", () => {
          card.classList.remove("card-revealing");
        }, { once: true });
      }, 300);
    }

    // 3. Запустить аудио/видео по активному сценарию
    mediaManager.applyScenario(mediaManager.currentScenarioKey, true);
  };

  if (enterOverlay) {
    enterOverlay.addEventListener("click", handleEnter);
    window.addEventListener("keydown", (e) => {
      if (!hasEntered && (e.key === "Enter" || e.key === " ")) {
        handleEnter();
      }
    });
  }

  // 9. Горячие клавиши (Пробел: Play/Pause, M: Mute)
  window.addEventListener("keydown", (e) => {
    if (!hasEntered) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.code === "Space") {
      e.preventDefault();
      mediaManager.togglePlay();
    } else if (e.code === "KeyM") {
      mediaManager.toggleGlobalMute();
    }
  });

  // 10. Копирование тегов соцсетей по клику
  setupSocialInteractions();
});

function populateProfileData(config) {
  const user = config.user;
  if (!user) return;

  // Name, Handle, Bio
  const nameEl = document.getElementById("profile-name");
  const handleEl = document.getElementById("profile-handle");
  const bioEl = document.getElementById("profile-bio");
  const regEl = document.getElementById("profile-joined");
  const locEl = document.getElementById("profile-location");
  const viewsEl = document.getElementById("profile-views");
  const avatarEl = document.getElementById("profile-avatar");

  if (nameEl) nameEl.textContent = user.name;
  if (handleEl) handleEl.textContent = user.handle;
  if (bioEl) bioEl.textContent = user.bio;
  if (regEl) regEl.textContent = user.registered;
  if (locEl) locEl.textContent = user.location;
  if (viewsEl) viewsEl.textContent = user.views;
  if (avatarEl && user.avatar) avatarEl.src = user.avatar;

  // Обновить ссылки соцсетей из конфига
  if (user.socials && user.socials.length > 0) {
    const socialLinks = document.querySelectorAll(".social-link-item");
    const socialMap = {};
    user.socials.forEach(s => {
      socialMap[s.name.toLowerCase()] = s;
    });

    socialLinks.forEach(link => {
      const tooltip = link.querySelector(".social-tooltip");
      const name = tooltip ? tooltip.textContent.trim().toLowerCase() : "";

      // Ищем соответствие по имени
      let matched = socialMap[name];
      if (!matched) {
        // Пробуем частичное совпадение (например "twitter / x" → "twitter/x")
        for (const key in socialMap) {
          if (name.includes(key) || key.includes(name.replace(/\s*\/\s*/g, "/"))) {
            matched = socialMap[key];
            break;
          }
        }
      }

      if (matched) {
        link.href = matched.url;
        if (matched.tag) {
          link.setAttribute("data-copy-tag", matched.tag);
        }
      }
    });
  }
}

function setupSocialInteractions() {
  const socialLinks = document.querySelectorAll(".social-link-item");
  const toast = document.getElementById("toast-notification");

  socialLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      const tag = link.getAttribute("data-copy-tag");
      if (tag) {
        navigator.clipboard.writeText(tag).catch(() => {});
        if (toast) {
          toast.textContent = `Copied: ${tag}`;
          toast.classList.add("toast-show");
          setTimeout(() => toast.classList.remove("toast-show"), 2000);
        }
      }
    });
  });
}

/**
 * Применяет настройки карточки из config.card
 * (прозрачность фона, размытие, скругление, рамка, паддинги)
 */
function applyCardSettings(config) {
  const card = document.getElementById("profile-card");
  if (!card || !config.card) return;

  const c = config.card;

  // Прозрачность фона карточки
  if (c.bgOpacity !== undefined) {
    card.style.background = `rgba(15, 15, 15, ${c.bgOpacity})`;
  }

  // Размытие за карточкой (backdrop-filter)
  if (c.bgBlur !== undefined) {
    card.style.backdropFilter = `blur(${c.bgBlur}px)`;
    card.style.webkitBackdropFilter = `blur(${c.bgBlur}px)`;
  }

  // Скругление углов
  if (c.borderRadius !== undefined) {
    card.style.borderRadius = `${c.borderRadius}px`;
  }

  // Прозрачность рамки
  if (c.borderOpacity !== undefined) {
    card.style.borderColor = `rgba(255, 255, 255, ${c.borderOpacity})`;
  }

  // Внутренние отступы
  if (c.padding !== undefined) {
    card.style.padding = `${c.padding}px`;
  }
}
