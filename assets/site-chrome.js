const headerHtml = `
  <header class="site-header" aria-label="Main site header">
    <div class="site-chrome-container">
      <div class="site-header-shell">
        <div class="site-header-bar">
          <a class="site-logo-link" href="index.html" aria-label="Canton Network intro home">
            <img src="https://canton.foundation/wp-content/themes/canton/assets/images/logo.svg" alt="Canton Foundation">
          </a>

          <div class="site-header-desktop">
            <nav class="site-nav-desktop" aria-label="Primary navigation">
              <ul class="site-nav-list">
                <li class="site-nav-item">
                  <a class="site-nav-link" href="https://canton.foundation/join-the-foundation/" target="_blank" rel="noopener">Join The Foundation</a>
                </li>
                <li class="site-nav-item">
                  <a class="site-nav-link" href="https://canton.foundation/about-the-foundation/" target="_blank" rel="noopener">About</a>
                </li>
                <li class="site-nav-item">
                  <details class="site-nav-details">
                    <summary class="site-nav-summary">Ecosystem</summary>
                    <div class="site-submenu">
                      <ul class="site-submenu-list">
                        <li><a href="featured-applications.html">Featured Apps</a></li>
                        <li><a href="featured-app-board.html">Featured App Board</a></li>
                        <li><a href="validator.html">Validators</a></li>
                        <li><a href="super-validator.html">Super Validators</a></li>
                        <li><a href="https://members.canton.foundation/" target="_blank" rel="noopener">Members</a></li>
                        <li><a href="https://canton.foundation/sv-network-status/" target="_blank" rel="noopener">SV Network Status</a></li>
                      </ul>
                    </div>
                  </details>
                </li>
                <li class="site-nav-item">
                  <details class="site-nav-details">
                    <summary class="site-nav-summary">Resources</summary>
                    <div class="site-submenu">
                      <ul class="site-submenu-list">
                        <li><a href="featured-app-coupon-guidance.html">Coupon Guidance</a></li>
                        <li><a href="featured-app-locking-faq.html">Locking FAQ</a></li>
                        <li><a href="sv-milestone-framework.html">SV Milestone Framework</a></li>
                        <li><a href="https://github.com/canton-foundation/cips" target="_blank" rel="noopener">Canton CIPs</a></li>
                        <li><a href="https://dev-hub.canton.foundation/" target="_blank" rel="noopener">Developer Tooling</a></li>
                        <li><a href="https://testnet-faucet.canton.foundation/" target="_blank" rel="noopener">Testnet Faucet</a></li>
                        <li><a href="https://docs.canton.network/" target="_blank" rel="noopener">Docs</a></li>
                      </ul>
                    </div>
                  </details>
                </li>
                <li class="site-nav-item">
                  <a class="site-nav-link" href="https://canton.foundation/contact-us/" target="_blank" rel="noopener">Contact</a>
                </li>
              </ul>
            </nav>

            <a class="site-member-cta" href="https://canton.foundation/join-the-foundation/" target="_blank" rel="noopener">
              Become A Member
            </a>
          </div>

          <button class="site-menu-toggle" type="button" data-site-nav-toggle aria-controls="siteMobileNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="site-menu-toggle-lines" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>

        <div class="site-mobile-panel" id="siteMobileNav" data-site-mobile-panel>
          <nav class="site-nav-mobile" aria-label="Mobile navigation">
            <ul class="site-mobile-list">
              <li><a class="site-mobile-link" href="https://canton.foundation/join-the-foundation/" target="_blank" rel="noopener">Join The Foundation</a></li>
              <li><a class="site-mobile-link" href="https://canton.foundation/about-the-foundation/" target="_blank" rel="noopener">About</a></li>
              <li>
                <details class="site-mobile-details">
                  <summary class="site-mobile-summary">Ecosystem</summary>
                  <ul class="site-mobile-submenu">
                    <li><a href="featured-applications.html">Featured Apps</a></li>
                    <li><a href="featured-app-board.html">Featured App Board</a></li>
                    <li><a href="validator.html">Validators</a></li>
                    <li><a href="super-validator.html">Super Validators</a></li>
                    <li><a href="https://members.canton.foundation/" target="_blank" rel="noopener">Members</a></li>
                    <li><a href="https://canton.foundation/sv-network-status/" target="_blank" rel="noopener">SV Network Status</a></li>
                  </ul>
                </details>
              </li>
              <li>
                <details class="site-mobile-details">
                  <summary class="site-mobile-summary">Resources</summary>
                  <ul class="site-mobile-submenu">
                    <li><a href="featured-app-coupon-guidance.html">Coupon Guidance</a></li>
                    <li><a href="featured-app-locking-faq.html">Locking FAQ</a></li>
                    <li><a href="sv-milestone-framework.html">SV Milestone Framework</a></li>
                    <li><a href="https://github.com/canton-foundation/cips" target="_blank" rel="noopener">Canton CIPs</a></li>
                    <li><a href="https://dev-hub.canton.foundation/" target="_blank" rel="noopener">Developer Tooling</a></li>
                    <li><a href="https://testnet-faucet.canton.foundation/" target="_blank" rel="noopener">Testnet Faucet</a></li>
                    <li><a href="https://docs.canton.network/" target="_blank" rel="noopener">Docs</a></li>
                  </ul>
                </details>
              </li>
              <li><a class="site-mobile-link" href="https://canton.foundation/contact-us/" target="_blank" rel="noopener">Contact</a></li>
            </ul>
          </nav>

          <a class="site-member-cta site-member-cta-mobile" href="https://canton.foundation/join-the-foundation/" target="_blank" rel="noopener">
            Become A Member
          </a>
        </div>
      </div>
    </div>
  </header>
`;

const footerHtml = `
  <footer class="site-footer" aria-label="Footer links">
    <div class="site-chrome-container">
      <div class="site-footer-shell">
        <div class="site-footer-grid">
          <div class="site-footer-brand">
            <a class="site-logo-link" href="index.html" aria-label="Canton Network intro home">
              <img src="https://canton.foundation/wp-content/themes/canton/assets/images/logo.svg" alt="Canton Foundation">
            </a>
          </div>

          <div class="site-footer-column">
            <h4 class="site-footer-title">Canton</h4>
            <ul class="site-footer-list">
              <li><a href="https://canton.foundation/join-the-foundation/" target="_blank" rel="noopener">Become A Member</a></li>
              <li><a href="https://canton.foundation/about-the-foundation/" target="_blank" rel="noopener">About Canton Foundation</a></li>
              <li><a href="https://canton.foundation/contact-us/" target="_blank" rel="noopener">Contact the Foundation</a></li>
            </ul>
          </div>

          <div class="site-footer-column">
            <h4 class="site-footer-title">Ecosystem</h4>
            <ul class="site-footer-list">
              <li><a href="featured-applications.html">Featured Apps</a></li>
              <li><a href="featured-app-board.html">Featured App Board</a></li>
              <li><a href="validator.html">Validators</a></li>
              <li><a href="super-validator.html">Super Validators</a></li>
              <li><a href="https://members.canton.foundation/" target="_blank" rel="noopener">Members</a></li>
            </ul>
          </div>

          <div class="site-footer-column">
            <h4 class="site-footer-title">Resources</h4>
            <ul class="site-footer-list">
              <li><a href="featured-app-coupon-guidance.html">Coupon Guidance</a></li>
              <li><a href="featured-app-locking-faq.html">Locking FAQ</a></li>
              <li><a href="sv-milestone-framework.html">SV Milestone Framework</a></li>
              <li><a href="https://github.com/canton-foundation/cips" target="_blank" rel="noopener">Canton CIPs</a></li>
              <li><a href="https://dev-hub.canton.foundation/" target="_blank" rel="noopener">Developer Tooling</a></li>
              <li><a href="https://testnet-faucet.canton.foundation/" target="_blank" rel="noopener">Testnet Faucet</a></li>
              <li><a href="https://docs.canton.network/" target="_blank" rel="noopener">Docs</a></li>
            </ul>
          </div>
        </div>

        <div class="site-footer-bottom">
          <p class="site-footer-copy">
            COPYRIGHT ©2026. CANTON FOUNDATION. ALL RIGHTS RESERVED.
            <a class="site-footer-privacy" href="https://canton.foundation/privacy-policy/" target="_blank" rel="noopener">PRIVACY POLICY</a>
          </p>

          <ul class="site-socials" aria-label="Social links">
            <li>
              <a class="site-social-link" href="https://www.linkedin.com/company/106042105/" target="_blank" rel="nofollow noopener noreferrer" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.94 8.5A1.44 1.44 0 1 1 6.94 5.6a1.44 1.44 0 0 1 0 2.88ZM5.7 10.2h2.47V18H5.7v-7.8Zm4.02 0h2.37v1.06h.03c.33-.59 1.14-1.21 2.35-1.21 2.52 0 2.98 1.66 2.98 3.82V18H15V13.7c0-1.02-.02-2.32-1.41-2.32-1.42 0-1.64 1.11-1.64 2.25V18H9.72v-7.8Z"/></svg>
              </a>
            </li>
            <li>
              <a class="site-social-link" href="https://x.com/CantonFdn" target="_blank" rel="nofollow noopener noreferrer" aria-label="X">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 3H21l-4.59 5.24L21.8 21h-4.22l-3.3-4.35L10.5 21H8.4l4.91-5.61L8.2 3h4.33l2.98 3.95L18.9 3Zm-.74 16.72h1.17L11.9 4.19h-1.25l7.5 15.53Z"/></svg>
              </a>
            </li>
            <li>
              <a class="site-social-link" href="https://github.com/canton-foundation" target="_blank" rel="nofollow noopener noreferrer" aria-label="GitHub">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.73.5 12.18c0 5.15 3.3 9.52 7.88 11.06.58.1.79-.25.79-.57 0-.28-.01-1.21-.02-2.2-3.2.71-3.87-1.38-3.87-1.38-.52-1.35-1.28-1.7-1.28-1.7-1.05-.73.08-.71.08-.71 1.16.08 1.76 1.21 1.76 1.21 1.03 1.8 2.7 1.28 3.36.98.1-.76.4-1.28.72-1.57-2.56-.3-5.26-1.3-5.26-5.77 0-1.27.44-2.31 1.17-3.12-.12-.3-.51-1.52.11-3.17 0 0 .96-.31 3.14 1.19a10.74 10.74 0 0 1 5.72 0c2.18-1.5 3.13-1.19 3.13-1.19.63 1.65.24 2.87.12 3.17.72.81 1.16 1.85 1.16 3.12 0 4.48-2.7 5.47-5.28 5.77.41.37.78 1.08.78 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.57 4.57-1.55 7.86-5.91 7.86-11.06C23.5 5.73 18.35.5 12 .5Z"/></svg>
              </a>
            </li>
            <li>
              <a class="site-social-link" href="https://discord.gg/canton" target="_blank" rel="nofollow noopener noreferrer" aria-label="Discord">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.2 5.35a15.14 15.14 0 0 0-3.79-1.17.05.05 0 0 0-.05.03c-.16.3-.34.69-.46.99a13.86 13.86 0 0 0-4.18 0 10.2 10.2 0 0 0-.47-.99.05.05 0 0 0-.05-.03c-1.32.22-2.6.61-3.79 1.17a.04.04 0 0 0-.02.02C3.96 8.98 3.3 12.5 3.63 15.97a.06.06 0 0 0 .02.04 15.23 15.23 0 0 0 4.65 2.36.05.05 0 0 0 .06-.02c.36-.5.68-1.03.96-1.6a.05.05 0 0 0-.03-.07c-.5-.2-.97-.44-1.42-.71a.05.05 0 0 1-.01-.08c.1-.08.2-.16.3-.25a.05.05 0 0 1 .05-.01c2.97 1.37 6.18 1.37 9.12 0a.05.05 0 0 1 .05.01c.1.09.2.17.3.25a.05.05 0 0 1-.01.08c-.45.27-.92.51-1.42.7a.05.05 0 0 0-.03.08c.29.56.61 1.1.96 1.59a.05.05 0 0 0 .06.02 15.17 15.17 0 0 0 4.66-2.36.05.05 0 0 0 .02-.04c.39-4.03-.65-7.52-2.76-10.6a.04.04 0 0 0-.02-.02ZM9.54 13.86c-.91 0-1.66-.85-1.66-1.9 0-1.04.73-1.9 1.66-1.9.93 0 1.67.86 1.66 1.9 0 1.05-.73 1.9-1.66 1.9Zm4.92 0c-.92 0-1.66-.85-1.66-1.9 0-1.04.73-1.9 1.66-1.9.93 0 1.67.86 1.66 1.9 0 1.05-.73 1.9-1.66 1.9Z"/></svg>
              </a>
            </li>
            <li>
              <a class="site-social-link" href="https://t.me/CantonNetwork1" target="_blank" rel="nofollow noopener noreferrer" aria-label="Telegram">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12S6.2 22.5 12 22.5 22.5 17.8 22.5 12 17.8 1.5 12 1.5Zm5.51 7.02-1.74 8.2c-.13.58-.47.72-.95.45l-2.62-1.94-1.27 1.22c-.14.14-.26.26-.53.26l.19-2.69 4.89-4.41c.21-.19-.05-.29-.33-.1l-6.04 3.8-2.6-.81c-.57-.18-.58-.57.12-.84l10.16-3.92c.47-.17.89.11.72.78Z"/></svg>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
`;

function mountSiteChrome() {
  for (const node of document.querySelectorAll("[data-site-header]")) {
    node.innerHTML = headerHtml;
  }

  for (const node of document.querySelectorAll("[data-site-footer]")) {
    node.innerHTML = footerHtml;
  }

  const current = location.pathname.split("/").pop() || "index.html";
  const activeSelector = [
    ".site-nav-link",
    ".site-submenu-list a",
    ".site-mobile-link",
    ".site-mobile-submenu a",
    ".site-footer-list a",
  ].join(", ");

  for (const link of document.querySelectorAll(activeSelector)) {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("#")) {
      continue;
    }

    if (href === current || (current === "" && href === "index.html")) {
      link.classList.add("is-active");

      const desktopDetails = link.closest(".site-nav-details");
      if (desktopDetails) {
        desktopDetails.classList.add("has-active-child");
      }

      const mobileDetails = link.closest(".site-mobile-details");
      if (mobileDetails) {
        mobileDetails.open = true;
        mobileDetails.classList.add("has-active-child");
      }

      if (link.matches(".site-nav-link, .site-mobile-link")) {
        link.setAttribute("aria-current", "page");
      }
    }
  }

  const toggle = document.querySelector("[data-site-nav-toggle]");
  const panel = document.querySelector("[data-site-mobile-panel]");
  const desktopDetailsList = [...document.querySelectorAll(".site-nav-details")];

  for (const details of desktopDetailsList) {
    const summary = details.querySelector(".site-nav-summary");
    if (!summary) {
      continue;
    }

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const nextOpen = !details.open;
      for (const item of desktopDetailsList) {
        item.open = false;
      }
      details.open = nextOpen;
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-nav-desktop")) {
      for (const details of desktopDetailsList) {
        details.open = false;
      }
    }
  });

  if (toggle && panel) {
    const closePanel = () => {
      panel.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const isOpen = panel.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1040) {
        closePanel();
      }
    });

    for (const link of panel.querySelectorAll("a")) {
      link.addEventListener("click", () => closePanel());
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountSiteChrome);
} else {
  mountSiteChrome();
}
