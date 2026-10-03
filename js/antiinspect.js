/**
 * Anti-Inspect & DevTools Blocker (guns.lol style protection)
 * 
 * 1. Блокирует контекстное меню (ПКМ / Просмотреть код).
 * 2. Блокирует горячие клавиши разработчика:
 *    - F12
 *    - Ctrl + Shift + I (Инспектор)
 *    - Ctrl + Shift + J (Консоль)
 *    - Ctrl + Shift + C (Выбор элемента)
 *    - Ctrl + U (Просмотр исходного кода)
 *    - Ctrl + S (Сохранение страницы)
 * 3. Запрещает выделение и перетаскивание контента.
 * 4. Anti-Debugger: принудительно замораживает DevTools, если открыт через меню браузера.
 */
(function() {
  // Проверка настройки в config.js
  if (typeof PROFILE_CONFIG !== "undefined" && PROFILE_CONFIG.effects && PROFILE_CONFIG.effects.antiInspect === false) {
    return;
  }

  // 1. Блокировка контекстного меню (ПКМ)
  document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, { capture: true });

  // 2. Блокировка шорткатов инспектора
  window.addEventListener("keydown", function(e) {
    // F12
    if (e.key === "F12" || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+I / J / C (или Cmd+Option+I / J / C)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      const code = e.keyCode || e.which;
      const key = (e.key || "").toUpperCase();
      if (key === "I" || key === "J" || key === "C" || code === 73 || code === 74 || code === 67) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }

    // Ctrl + U (Просмотр кода страницы)
    if ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U" || e.keyCode === 85)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + S (Сохранение страницы)
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S" || e.keyCode === 83)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // 3. Запрет перетаскивания элементов
  document.addEventListener("dragstart", function(e) {
    e.preventDefault();
    return false;
  }, { capture: true });

  // 4. Anti-debugger (замораживает инспектор, если открыли через настройки браузера)
  setInterval(function() {
    try {
      (function() {
        return false;
      }["constructor"]("debugger")());
    } catch (e) {}
  }, 400);
})();
