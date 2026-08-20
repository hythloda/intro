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
                        <li><a href="featured-app-partyid-changes.html">FA PartyID Changes</a></li>
                        <li><a href="validator.html">Validators</a></li>
                        <li><a href="super-validator.html">Super Validators</a></li>
                        <li><a href="member.html">Members</a></li>
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
                    <li><a href="featured-app-partyid-changes.html">FA PartyID Changes</a></li>
                    <li><a href="validator.html">Validators</a></li>
                    <li><a href="super-validator.html">Super Validators</a></li>
                    <li><a href="member.html">Members</a></li>
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
            <img src="https://canton.foundation/wp-content/themes/canton/assets/images/logo.svg" width="186" height="52" alt="Canton Foundation">
          </div>

          <div class="site-footer-column">
            <h4 class="site-footer-title">Canton</h4>
            <ul class="site-footer-list">
              <li><a href="https://canton.foundation/membership/">Become A Member</a></li>
              <li><a href="https://canton.foundation/about-the-foundation/" target="_blank" rel="noopener">About Canton Foundation</a></li>
              <li><a href="https://canton.foundation/contact-us/" target="_blank" rel="noopener">Contact the Foundation</a></li>
            </ul>
          </div>

          <div class="site-footer-column">
            <h4 class="site-footer-title">Ecosystem</h4>
            <ul class="site-footer-list">
              <li><a href="https://canton.foundation/canton-apps/">Canton Apps</a></li>
              <li><a href="https://canton.foundation/validators/">Validators</a></li>
              <li><a href="https://canton.foundation/sv-network-status/">SV Network Status</a></li>
            </ul>
          </div>

          <div class="site-footer-column">
            <h4 class="site-footer-title">Resources</h4>
            <ul class="site-footer-list">
              <li><a href="https://canton.foundation/news/">News</a></li>
              <li><a href="https://canton.foundation/press-releases/">Press Releases</a></li>
              <li><a href="https://canton.foundation/working-groups/">Working Groups</a></li>
              <li><a href="https://www.canton.network/whitepapers" target="_blank" rel="noopener">Whitepapers</a></li>
              <li><a href="https://docs.canton.network/" target="_blank" rel="noopener">Developer Docs</a></li>
              <li><a href="https://climate.canton.network/">Sustainability Dashboard</a></li>
              <li><a href="https://github.com/canton-foundation/cips">Canton CIPs</a></li>
            </ul>
          </div>
        </div>

        <div class="site-footer-bottom">
          <p class="site-footer-copy">
            Copyright ©2026. Canton Foundation. All rights reserved.
            <a class="site-footer-privacy" href="https://canton.foundation/privacy-policy/">Privacy Policy</a>.
            <a class="site-footer-privacy" href="https://canton.foundation/responsible-disclosure/">Responsible Disclosure</a>
          </p>

          <ul class="site-socials" aria-label="Social links">
            <li>
              <a class="site-social-link" href="https://www.linkedin.com/company/106042105/" target="_blank" rel="nofollow noopener noreferrer" aria-label="LinkedIn">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="15" cy="15" r="15" fill="#030206"/>
                  <path d="M7.74668 11.2308H10.8584V21.25H7.74666L7.74668 11.2308ZM9.30346 6.25C10.2983 6.25 11.1049 7.0596 11.1049 8.05511C11.1049 9.05166 10.2983 9.86115 9.30347 9.86115C8.30508 9.86115 7.5 9.05166 7.5 8.05511C7.49998 7.0596 8.30505 6.25 9.30346 6.25ZM12.809 11.2308H15.7889V12.6002H15.8312C16.2455 11.8118 17.2603 10.9817 18.7728 10.9817C21.9182 10.9817 22.5 13.0559 22.5 15.7543V21.25H19.3941V16.3787C19.3941 15.2158 19.3712 13.721 17.7783 13.721C16.1604 13.721 15.9137 14.9866 15.9137 16.2927V21.25H12.809V11.2308Z" fill="white"/>
                </svg>
              </a>
            </li>
            <li>
              <a class="site-social-link" href="https://x.com/CantonFdn" target="_blank" rel="nofollow noopener noreferrer" aria-label="X">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="15" cy="15" r="15" fill="#030206"/>
                  <path d="M13.5715 13.8522L7.9865 7.5H9.3095L14.161 13.0144L18.033 7.5H22.5L16.6435 15.8396L22.5 22.5H21.177L16.057 16.6754L11.967 22.5H7.5M20.6995 8.47619H18.667L9.3105 21.5718H11.3435" fill="white"/>
                </svg>
              </a>
            </li>
            <li>
              <a class="site-social-link" href="https://github.com/canton-foundation" target="_blank" rel="nofollow noopener noreferrer" aria-label="GitHub">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M10.0083 0C4.47396 0 0 4.58331 0 10.2535C0 14.786 2.86662 18.6226 6.84338 19.9805C7.34058 20.0826 7.5227 19.7599 7.5227 19.4885C7.5227 19.2508 7.50631 18.436 7.50631 17.587C4.72225 18.1983 4.14249 16.3647 4.14249 16.3647C3.69508 15.1764 3.03215 14.871 3.03215 14.871C2.12092 14.2429 3.09852 14.2429 3.09852 14.2429C4.1093 14.3108 4.63969 15.2954 4.63969 15.2954C5.53432 16.857 6.97592 16.4158 7.55588 16.1441C7.63865 15.482 7.90394 15.0237 8.18563 14.7691C5.96514 14.5314 3.62891 13.6487 3.62891 9.71017C3.62891 8.58976 4.02634 7.67309 4.65608 6.96018C4.55672 6.7056 4.20866 5.65289 4.75564 4.24394C4.75564 4.24394 5.60069 3.97228 7.5061 5.29644C8.32188 5.07199 9.16317 4.95782 10.0083 4.95685C10.8533 4.95685 11.7148 5.07581 12.5102 5.29644C14.4159 3.97228 15.2609 4.24394 15.2609 4.24394C15.8079 5.65289 15.4596 6.7056 15.3603 6.96018C16.0066 7.67309 16.3876 8.58976 16.3876 9.71017C16.3876 13.6487 14.0514 14.5143 11.8143 14.7691C12.179 15.0916 12.4936 15.7026 12.4936 16.6703C12.4936 18.0453 12.4773 19.1489 12.4773 19.4883C12.4773 19.7599 12.6596 20.0826 13.1566 19.9808C17.1333 18.6224 20 14.786 20 10.2535C20.0163 4.58331 15.526 0 10.0083 0Z" fill="white"/>
                </svg>
              </a>
            </li>
            <li>
              <a class="site-social-link" href="https://discord.gg/canton" target="_blank" rel="nofollow noopener noreferrer" aria-label="Discord">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="15" cy="15" r="15" fill="#030206"/>
                  <path d="M19.8047 9.36328C18.6562 8.83594 17.4375 8.46094 16.1719 8.25781C16.1562 8.25781 16.1406 8.25781 16.125 8.26562C15.9688 8.54688 15.7969 8.92188 15.6719 9.21875C14.3281 9.03125 13 9.03125 11.6875 9.21875C11.5625 8.90625 11.3906 8.54688 11.2344 8.26562C11.2188 8.25781 11.2031 8.25781 11.1875 8.25781C9.92188 8.46094 8.70312 8.83594 7.55469 9.36328C7.54688 9.36328 7.53906 9.37109 7.53125 9.37891C5.34375 12.5547 4.73438 15.6484 5.03906 18.7031C5.03906 18.7188 5.04688 18.7344 5.0625 18.7422C6.64844 19.8984 8.1875 20.6016 9.70312 21.0938C9.71875 21.0938 9.73438 21.0938 9.74219 21.0781C10.0938 20.6016 10.4141 20.1016 10.6875 19.5781C10.6953 19.5625 10.6875 19.5469 10.6719 19.5391C10.1797 19.3438 9.70312 19.1094 9.25 18.8359C9.23438 18.8281 9.23438 18.8047 9.24219 18.7969C9.35156 18.7188 9.45312 18.6328 9.55469 18.5469C9.5625 18.5391 9.57812 18.5391 9.58594 18.5391C12.2422 19.7734 15.1484 19.7734 17.7734 18.5391C17.7812 18.5391 17.7969 18.5391 17.8047 18.5469C17.9062 18.6328 18.0078 18.7188 18.125 18.7969C18.1406 18.8047 18.1406 18.8281 18.1172 18.8359C17.6719 19.1172 17.1875 19.3438 16.6953 19.5391C16.6797 19.5469 16.6797 19.5625 16.6797 19.5781C16.9609 20.1016 17.2734 20.5938 17.625 21.0781C17.6406 21.0938 17.6562 21.0938 17.6719 21.0938C19.1953 20.6016 20.7344 19.8984 22.3203 18.7422C22.3359 18.7344 22.3438 18.7188 22.3438 18.7031C22.7031 15.2266 21.7812 12.1562 19.8359 9.37891C19.8281 9.37109 19.8203 9.36328 19.8047 9.36328ZM11.2344 16.9141C10.4531 16.9141 9.8125 16.1797 9.8125 15.2656C9.8125 14.3516 10.4375 13.6172 11.2344 13.6172C12.0312 13.6172 12.6719 14.3516 12.6562 15.2656C12.6562 16.1797 12.0312 16.9141 11.2344 16.9141ZM16.1406 16.9141C15.3594 16.9141 14.7188 16.1797 14.7188 15.2656C14.7188 14.3516 15.3438 13.6172 16.1406 13.6172C16.9375 13.6172 17.5781 14.3516 17.5625 15.2656C17.5625 16.1797 16.9375 16.9141 16.1406 16.9141Z" fill="white"/>
                </svg>
              </a>
            </li>
            <li>
              <a class="site-social-link" href="https://t.me/CantonNetwork1" target="_blank" rel="nofollow noopener noreferrer" aria-label="Email">
                <svg xmlns="http://www.w3.org/2000/svg" width="21" height="20" fill="none" viewBox="0 0 21 20" aria-hidden="true">
                  <g clip-path="url(#telegram-footer-icon)">
                    <path fill="#FFFFFC" d="M10.5 20c5.523 0 10-4.477 10-10s-4.477-10-10-10S.5 4.477.5 10s4.477 10 10 10Z"/>
                    <path fill="#030206" fill-rule="evenodd" d="M5.027 9.894c2.915-1.27 4.859-2.107 5.832-2.512 2.777-1.155 3.354-1.355 3.73-1.362.083-.001.268.02.387.116a.421.421 0 0 1 .143.271c.013.078.03.255.016.394-.15 1.581-.801 5.418-1.133 7.19-.14.749-.416 1-.683 1.025-.58.053-1.022-.384-1.584-.753-.88-.577-1.377-.936-2.232-1.499-.987-.65-.347-1.008.216-1.593.147-.153 2.706-2.48 2.755-2.691.006-.026.012-.125-.046-.177-.059-.052-.145-.034-.208-.02-.088.02-1.494.95-4.218 2.788-.399.274-.76.408-1.084.4-.357-.007-1.044-.201-1.554-.367-.627-.204-1.124-.311-1.081-.657.022-.18.27-.364.744-.553Z" clip-rule="evenodd"/>
                  </g>
                  <defs><clipPath id="telegram-footer-icon"><path fill="#fff" d="M.5 0h20v20H.5z"/></clipPath></defs>
                </svg>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
`;

const footerGuardCss = `
  .site-footer, .site-footer * { box-sizing: border-box !important; }
  .site-footer { position: relative !important; z-index: 20 !important; margin-top: 20px !important; font-family: "IBM Plex Sans", "Helvetica Neue", Helvetica, Arial, sans-serif !important; }
  .site-footer .site-chrome-container { max-width: 1410px !important; margin: 0 auto !important; padding: 0 30px !important; }
  .site-footer-shell { border-radius: 40px !important; padding: 36px 48px 24px !important; background: rgba(3, 2, 6, 0.95) !important; border: 1px solid rgba(135, 92, 255, 0.68) !important; box-shadow: 0 28px 70px rgba(0, 0, 0, 0.36) !important; }
  .site-footer-grid { display: grid !important; grid-template-columns: minmax(360px, 1.8fr) repeat(3, minmax(150px, 1fr)) !important; gap: 18px 28px !important; align-items: start !important; }
  .site-footer-brand img { display: block !important; width: 168px !important; height: auto !important; }
  .site-footer-title { margin: 0 0 8px !important; color: #fff !important; font-size: 16px !important; font-weight: 400 !important; line-height: 1.2 !important; }
  .site-footer-list { display: grid !important; gap: 8px !important; list-style: none !important; margin: 0 !important; padding: 0 !important; }
  .site-footer-list a, .site-footer-privacy { color: rgba(255, 255, 255, 0.78) !important; text-decoration: none !important; font-size: 14px !important; font-weight: 400 !important; line-height: 1.3 !important; }
  .site-footer-bottom { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; margin-top: 20px !important; }
  .site-footer-copy { order: 1 !important; margin: 0 !important; color: rgba(255, 255, 255, 0.82) !important; font-size: 11px !important; font-weight: 400 !important; letter-spacing: 0.06em !important; text-transform: uppercase !important; line-height: 1.5 !important; }
  .site-socials { order: 2 !important; display: flex !important; align-items: center !important; gap: 16px !important; list-style: none !important; margin: 0 !important; padding: 0 !important; }
  .site-social-link { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 28px !important; height: 28px !important; color: #fff !important; text-decoration: none !important; }
  .site-social-link svg { display: block !important; flex: 0 0 auto !important; }
  @media (max-width: 1500px) {
    .site-footer-shell { padding: 32px 42px 22px !important; }
    .site-footer-grid { grid-template-columns: minmax(210px, 1.25fr) repeat(3, minmax(110px, 1fr)) !important; column-gap: 30px !important; row-gap: 12px !important; }
    .site-footer-title { margin-bottom: 8px !important; font-size: 14px !important; }
    .site-footer-list { gap: 7px !important; }
    .site-footer-list a, .site-footer-privacy { font-size: 12px !important; line-height: 1.28 !important; }
    .site-footer-copy { order: 2 !important; font-size: 11px !important; line-height: 1.55 !important; }
    .site-footer-bottom { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; margin-top: 18px !important; }
    .site-socials { order: 1 !important; }
  }
  @media (max-width: 1100px) {
    .site-footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; column-gap: 30px !important; row-gap: 12px !important; }
    .site-footer-brand { grid-column: 1 / -1 !important; margin-bottom: 0 !important; }
  }
  @media (max-width: 1040px) {
    .site-footer-shell { padding: 26px 30px 20px !important; border-radius: 28px !important; }
    .site-footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; column-gap: 24px !important; row-gap: 10px !important; }
    .site-footer-bottom { gap: 10px !important; margin-top: 16px !important; }
  }
  @media (max-width: 640px) {
    .site-footer .site-chrome-container { padding: 0 14px !important; }
    .site-footer-shell { padding: 22px 20px 18px !important; }
    .site-footer-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
    .site-footer-list { gap: 7px !important; }
    .site-footer-list a, .site-footer-privacy { font-size: 12px !important; }
    .site-footer-bottom { margin-top: 14px !important; }
    .site-footer-copy { font-size: 10px !important; }
  }
`;

function ensureFooterGuardStyles() {
  if (document.getElementById("site-footer-guard-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "site-footer-guard-styles";
  style.textContent = footerGuardCss;
  document.head.appendChild(style);
}

function mountSiteChrome() {
  ensureFooterGuardStyles();

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
