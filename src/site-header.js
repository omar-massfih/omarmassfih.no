class SiteHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header>
        <nav class="flex-container">
          <a class="header-nav-left" href="/index.html">Omar Massfih</a>
          <span class="header-nav-right">
            <a href="/prosjekter.html">Prosjekter</a>
            <a href="/notater.html">Notater</a>
            <a href="/om.html">Om</a>
          </span>
        </nav>
      </header>`;

    for (const a of this.querySelectorAll(".header-nav-right a")) {
      if (a.getAttribute("href") === location.pathname) {
        a.setAttribute("aria-current", "page");
      }
    }
  }
}

customElements.define("site-header", SiteHeader);
