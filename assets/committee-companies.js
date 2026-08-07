(function () {
  const data = window.COMMITTEE_COMPANIES_DATA;

  const formatDate = (value) => {
    if (!value) {
      return "Not synced yet";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "Last synced recently";
    }

    return `Last synced ${parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    })}`;
  };

  const escapeHtml = (value) => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const renderCompanyLists = () => {
    const targets = document.querySelectorAll("[data-committee-companies]");

    if (!targets.length) {
      return;
    }

    targets.forEach((target) => {
      const key = target.getAttribute("data-committee-companies");
      const committee = data?.committees?.[key];
      const companies = Array.isArray(committee?.companies) ? committee.companies : [];

      if (!committee || companies.length === 0) {
        target.innerHTML = `
          <p class="company-empty">
            Participating member companies will appear here after the next Groups.io sync.
          </p>
        `;
        return;
      }

      target.innerHTML = `
        <div class="company-summary">
          <span>${companies.length} participating member ${companies.length === 1 ? "company" : "companies"}</span>
          <span>${formatDate(data.generatedAt)}</span>
        </div>
        <ul class="company-list">
          ${companies.map((company) => `<li>${escapeHtml(company)}</li>`).join("")}
        </ul>
      `;
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderCompanyLists, { once: true });
  } else {
    renderCompanyLists();
  }
}());
