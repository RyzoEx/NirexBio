/**
 * Custom PNG Image Cursor with Fixed Dimensions & Responsive Scaling
 * Automatically scales down any high-resolution image (e.g. 1080x1080) to fixed cursor size
 */
class CustomCursor {
  constructor(options = {}) {
    // Only initialize on desktop mouse devices
    if (window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    this.cursor = document.getElementById("custom-cursor");
    if (!this.cursor) return;

    this.options = Object.assign({
      size: 28, // Fixed pixel size for cursor
      image: null,
      hotspotX: 0,
      hotspotY: 0
    }, options);

    this.mouseX = -100;
    this.mouseY = -100;
    this.isVisible = false;
    this.isHovered = false;
    this.isActive = false;

    this.init();
  }

  init() {
    // If a custom image/gif is specified, apply it
    if (this.options.image) {
      this.cursor.src = this.options.image;
    }

    // Ensure fixed size style directly applied
    this.cursor.style.width = `${this.options.size}px`;
    this.cursor.style.height = `${this.options.size}px`;

    // Track mouse movement
    window.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      if (!this.isVisible) {
        this.isVisible = true;
        this.cursor.style.opacity = "1";
      }

      this.updatePosition();
    });

    // Hide when mouse leaves window
    document.addEventListener("mouseleave", () => {
      this.isVisible = false;
      this.cursor.style.opacity = "0";
    });

    document.addEventListener("mouseenter", () => {
      this.isVisible = true;
      this.cursor.style.opacity = "1";
    });

    // Click press effect
    window.addEventListener("mousedown", () => {
      this.isActive = true;
      this.cursor.classList.add("cursor-active");
      this.updatePosition();
    });

    window.addEventListener("mouseup", () => {
      this.isActive = false;
      this.cursor.classList.remove("cursor-active");
      this.updatePosition();
    });

    // Hover effect over clickable / interactive elements
    const interactiveSelectors = 'a, button, input, textarea, select, [role="button"], .clickable, .player-btn, .progress-container, .social-link-item, .badge-item';
    
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(interactiveSelectors)) {
        this.isHovered = true;
        this.cursor.classList.add("cursor-hover");
        this.updatePosition();
      }
    });

    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(interactiveSelectors)) {
        this.isHovered = false;
        this.cursor.classList.remove("cursor-hover");
        this.updatePosition();
      }
    });
  }

  updatePosition() {
    const posX = this.mouseX - this.options.hotspotX;
    const posY = this.mouseY - this.options.hotspotY;
    const scale = this.isActive ? 0.9 : (this.isHovered ? 1.18 : 1);
    
    this.cursor.style.transform = `translate3d(${posX}px, ${posY}px, 0) scale(${scale})`;
  }
}

window.CustomCursor = CustomCursor;
