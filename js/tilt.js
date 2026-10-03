/**
 * High-performance 3D Parallax Tilt with Glass Glare
 */
class CardTilt {
  constructor(element, options = {}) {
    this.card = element;
    if (!this.card) return;

    this.options = Object.assign({
      maxAngle: 12,
      perspective: 1000,
      scale: 1.015,
      speed: 600,
      easing: "cubic-bezier(.03,.98,.52,.99)",
      glare: true,
      maxGlare: 0.22,
      depth: true
    }, options);

    this.width = null;
    this.height = null;
    this.left = null;
    this.top = null;
    this.transitionTimeout = null;
    this.updateCall = null;

    this.tiltX = 0;
    this.tiltY = 0;
    this.targetTiltX = 0;
    this.targetTiltY = 0;

    this.init();
  }

  init() {
    this.updateDimensions();
    this.setupGlare();
    this.bindEvents();
  }

  setupGlare() {
    if (!this.options.glare) return;

    this.glareWrapper = document.createElement("div");
    this.glareWrapper.className = "tilt-glare-wrapper";
    this.glareWrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: inherit;
      pointer-events: none;
      z-index: 10;
    `;

    this.glareElement = document.createElement("div");
    this.glareElement.className = "tilt-glare-inner";
    this.glareElement.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      pointer-events: none;
      background-image: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, ${this.options.maxGlare}), rgba(255, 255, 255, 0) 70%);
      width: 250%;
      height: 250%;
      transform: translate(-50%, -50%);
      opacity: 0;
      transition: opacity ${this.options.speed}ms ${this.options.easing};
    `;

    this.glareWrapper.appendChild(this.glareElement);
    this.card.appendChild(this.glareWrapper);
  }

  updateDimensions() {
    const rect = this.card.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.left = rect.left;
    this.top = rect.top;
  }

  bindEvents() {
    window.addEventListener("resize", () => this.updateDimensions());
    window.addEventListener("scroll", () => this.updateDimensions());

    this.onMouseEnter = this.handleMouseEnter.bind(this);
    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onMouseLeave = this.handleMouseLeave.bind(this);

    this.card.addEventListener("mouseenter", this.onMouseEnter);
    this.card.addEventListener("mousemove", this.onMouseMove);
    this.card.addEventListener("mouseleave", this.onMouseLeave);
  }

  handleMouseEnter() {
    this.updateDimensions();
    this.card.style.willChange = "transform";
    this.setTransition();
    if (this.glareElement) {
      this.glareElement.style.opacity = "1";
    }
  }

  handleMouseMove(event) {
    if (this.updateCall !== null) {
      cancelAnimationFrame(this.updateCall);
    }

    const mouseX = event.clientX - this.left;
    const mouseY = event.clientY - this.top;

    const percentX = Math.min(Math.max(mouseX / this.width, 0), 1);
    const percentY = Math.min(Math.max(mouseY / this.height, 0), 1);

    // Calculate angles
    this.targetTiltX = ((percentY - 0.5) * -this.options.maxAngle).toFixed(2);
    this.targetTiltY = ((percentX - 0.5) * this.options.maxAngle).toFixed(2);

    this.updateCall = requestAnimationFrame(() => this.updateTransforms(percentX, percentY));
  }

  handleMouseLeave() {
    this.setTransition();
    this.targetTiltX = 0;
    this.targetTiltY = 0;

    this.card.style.transform = `perspective(${this.options.perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;

    if (this.glareElement) {
      this.glareElement.style.opacity = "0";
      this.glareElement.style.transform = `translate(-50%, -50%) rotate(0deg)`;
    }

    // Reset parallax depth children
    const depthElements = this.card.querySelectorAll("[data-tilt-depth]");
    depthElements.forEach(el => {
      el.style.transform = "translateZ(0px)";
    });
  }

  setTransition() {
    clearTimeout(this.transitionTimeout);
    this.card.style.transition = `transform ${this.options.speed}ms ${this.options.easing}`;
    if (this.glareElement) {
      this.glareElement.style.transition = `opacity ${this.options.speed}ms ${this.options.easing}, transform ${this.options.speed}ms ${this.options.easing}`;
    }

    this.transitionTimeout = setTimeout(() => {
      this.card.style.transition = "";
      if (this.glareElement) {
        this.glareElement.style.transition = "";
      }
    }, this.options.speed);
  }

  updateTransforms(percentX, percentY) {
    this.card.style.transform = `perspective(${this.options.perspective}px) rotateX(${this.targetTiltX}deg) rotateY(${this.targetTiltY}deg) scale3d(${this.options.scale}, ${this.options.scale}, ${this.options.scale})`;

    if (this.glareElement) {
      const angle = Math.atan2(percentY - 0.5, percentX - 0.5) * (180 / Math.PI) - 90;
      const posX = percentX * 100;
      const posY = percentY * 100;
      this.glareElement.style.transform = `translate(-${posX}%, -${posY}%) rotate(${angle}deg)`;
    }

    // Apply 3D parallax depth to elements
    if (this.options.depth) {
      const depthElements = this.card.querySelectorAll("[data-tilt-depth]");
      depthElements.forEach(el => {
        const depthVal = el.getAttribute("data-tilt-depth") || 20;
        el.style.transform = `translateZ(${depthVal}px)`;
      });
    }

    this.updateCall = null;
  }
}

window.CardTilt = CardTilt;
