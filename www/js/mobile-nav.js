/**
 * @fileoverview Mobile Navigation System
 * Provides hamburger menu navigation, device detection, and touch gesture support
 * for responsive layouts across mobile, tablet, and desktop devices.
 * 
 * @author Home Monitor Platform
 * @version 1.0.0
 */

/**
 * Breakpoint constants for responsive design
 * @const {Object}
 */
const BREAKPOINTS = {
  MOBILE_SMALL: 480,
  MOBILE: 768,
  TABLET: 1024
};

/**
 * Interaction configuration
 * @const {Object}
 */
const CONFIG = {
  SWIPE_THRESHOLD: 50,        // Minimum pixels for swipe gesture
  RESIZE_DEBOUNCE: 250,       // Milliseconds to debounce resize events
  NAV_CLOSE_DELAY: 100        // Delay before closing menu on navigation
};

/**
 * Device Detection Utility
 * Provides reliable device and viewport detection without User Agent sniffing
 * 
 * @namespace
 */
const DeviceDetection = {
  /**
   * Check if device has touch capability
   * More reliable than User Agent sniffing
   * 
   * @returns {boolean} True if touch events are supported
   */
  isTouchDevice() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
  },

  /**
   * Check if viewport is currently in mobile/tablet size
   * This is the primary check - responds to actual available space
   * 
   * @returns {boolean} True if viewport width is at or below tablet breakpoint
   */
  isMobileViewport() {
    return window.innerWidth <= BREAKPOINTS.TABLET;
  },

  /**
   * Check if device screen size suggests mobile/tablet form factor
   * Note: Screen.width is device width, not viewport
   * 
   * @returns {boolean} True if screen width is at or below tablet breakpoint
   */
  isMobileScreen() {
    return window.screen.width <= BREAKPOINTS.TABLET;
  },

  /**
   * Determine if we're currently in "mobile mode"
   * Uses viewport as primary signal (most important for layout decisions)
   * 
   * @returns {boolean} True if mobile UI should be shown
   */
  isMobileMode() {
    return this.isMobileViewport();
  },

  /**
   * Detect if device is likely a touch-primary device (phone/tablet)
   * Useful for optimizing touch interactions
   * 
   * @returns {boolean} True if device has touch AND small screen
   */
  isTouchPrimary() {
    return this.isTouchDevice() && this.isMobileScreen();
  },

  /**
   * Classify device type based on viewport width and touch capability
   * Useful for debugging, analytics, and edge-case optimizations
   * 
   * @returns {string} Device type: 'mobile-small', 'mobile', 'tablet', 
   *                   'desktop-small', 'desktop-touch', or 'desktop'
   */
  getDeviceType() {
    const width = window.innerWidth;
    const isTouch = this.isTouchDevice();
    
    if (width < BREAKPOINTS.MOBILE_SMALL) return 'mobile-small';
    if (width < BREAKPOINTS.MOBILE) return 'mobile';
    if (width < BREAKPOINTS.TABLET) return isTouch ? 'tablet' : 'desktop-small';
    return isTouch ? 'desktop-touch' : 'desktop';
  }
};

/**
 * Mobile Menu Controller
 * Manages the hamburger menu state and interactions
 * 
 * @class
 */
class MobileMenu {
  /**
   * Create a mobile menu controller
   * 
   * @param {HTMLElement} toggleButton - The hamburger menu button
   * @param {HTMLElement} sidebar - The sidebar navigation element
   * @param {HTMLElement} overlay - The backdrop overlay element
   */
  constructor(toggleButton, sidebar, overlay) {
    this.toggleButton = toggleButton;
    this.sidebar = sidebar;
    this.overlay = overlay;
    this.resizeTimer = null;
  }

  /**
   * Initialize the mobile menu with all event listeners
   */
  init() {
    this.updateDeviceAttributes();
    this.attachEventListeners();
    this.setupTouchGestures();
    this.logDeviceInfo();
  }

  /**
   * Update HTML data attributes with current device information
   * Allows CSS to respond to device capabilities
   */
  updateDeviceAttributes() {
    document.documentElement.dataset.deviceType = DeviceDetection.getDeviceType();
    document.documentElement.dataset.touchDevice = DeviceDetection.isTouchDevice();
  }

  /**
   * Attach all event listeners for menu interactions
   */
  attachEventListeners() {
    // Toggle menu on button click
    this.toggleButton.addEventListener('click', () => this.toggleMenu());

    // Close menu when clicking overlay
    this.overlay.addEventListener('click', () => this.closeMenu());

    // Close menu when clicking navigation links
    this.sidebar.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', () => {
        setTimeout(() => this.closeMenu(), CONFIG.NAV_CLOSE_DELAY);
      });
    });

    // Handle window resize with debouncing
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Setup touch gesture support for swipe-to-close on touch devices
   */
  setupTouchGestures() {
    if (!DeviceDetection.isTouchDevice()) return;

    let touchStartX = 0;

    this.sidebar.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    this.sidebar.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const swipeDistance = touchStartX - touchEndX;
      
      // Swipe left to close (exceeds threshold)
      if (swipeDistance > CONFIG.SWIPE_THRESHOLD && this.isMenuOpen()) {
        this.closeMenu();
      }
    }, { passive: true });
  }

  /**
   * Toggle menu between open and closed states
   */
  toggleMenu() {
    if (this.isMenuOpen()) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  /**
   * Open the mobile menu
   */
  openMenu() {
    this.sidebar.classList.add('active');
    this.toggleButton.classList.add('active');
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close the mobile menu and restore scrolling
   */
  closeMenu() {
    this.sidebar.classList.remove('active');
    this.toggleButton.classList.remove('active');
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Check if menu is currently open
   * 
   * @returns {boolean} True if menu is open
   */
  isMenuOpen() {
    return this.sidebar.classList.contains('active');
  }

  /**
   * Handle window resize events with debouncing
   * Updates device attributes and closes menu if resizing to desktop
   */
  handleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.updateDeviceAttributes();
      
      // Close menu when viewport reaches desktop size
      if (!DeviceDetection.isMobileMode() && this.isMenuOpen()) {
        this.closeMenu();
      }
    }, CONFIG.RESIZE_DEBOUNCE);
  }

  /**
   * Log device detection information to console (development only)
   */
  logDeviceInfo() {
    const isDevelopment = 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';
    
    if (isDevelopment) {
      console.log('📱 Device Detection:', {
        type: DeviceDetection.getDeviceType(),
        touch: DeviceDetection.isTouchDevice(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        screen: `${window.screen.width}x${window.screen.height}`,
        mobileMode: DeviceDetection.isMobileMode()
      });
    }
  }
}

/**
 * Initialize mobile navigation on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  // Only initialize if all required elements exist
  if (toggleButton && sidebar && overlay) {
    const mobileMenu = new MobileMenu(toggleButton, sidebar, overlay);
    mobileMenu.init();
    
    // Expose utilities globally for debugging and potential plugin use
    window.DeviceDetection = DeviceDetection;
    window.MobileMenu = mobileMenu;
  }
});
