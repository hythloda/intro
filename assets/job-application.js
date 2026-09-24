(() => {
  "use strict";
  const schema = JOB_APPLICATION_SCHEMA;
  const config = window.JOB_APPLICATION_CONFIG || {};
  const form = document.querySelector("#job-application");
  const fields = document.querySelector("#application-fields");
  const submit = document.querySelector("#application-submit");
  const status = document.querySelector("#application-status");
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint || "") ||
    (local && config.endpoint === location.origin + "/application-test");
  const submissionConfigured = config.enabled === true && validEndpoint && Boolean(config.turnstileSiteKey);
  const storageKey = "canton-accounting-application-request";
  let requestId;
  try { requestId = sessionStorage.getItem(storageKey); } catch (_) { /* Storage is optional. */ }
  if (!/^[a-f0-9-]{36}$/.test(requestId || "")) requestId = crypto.randomUUID();
  let busy = false;
  let token = "";
  let widget;

  const countries = schema.countryCodes.map(code => [code, schema.countryNames[code]])
    .sort((a, b) => a[1].localeCompare(b[1]));
  for (const field of schema.fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "application-field";
    if (["textarea", "url"].includes(field.type) || ["experience", "voluntary"].includes(field.section)) {
      wrapper.classList.add("application-field-wide");
    }
    const label = document.createElement("label");
    label.htmlFor = field.key;
    label.textContent = field.label + (field.required ? " *" : "");
    const input = document.createElement(field.type === "textarea" ? "textarea" :
      ["select", "country"].includes(field.type) ? "select" : "input");
    input.id = input.name = field.key;
    input.required = Boolean(field.required);
    if (input.tagName === "INPUT") input.type = field.type;
    if (field.autocomplete) input.autocomplete = field.autocomplete;
    if (field.max) input.maxLength = field.max;
    if (field.type === "file") input.accept = ".pdf,.doc,.docx";
    if (input.tagName === "SELECT") {
      input.add(new Option(field.required ? "Select an option" : "Select an option (optional)", ""));
      for (const [value, text] of field.type === "country" ? countries : field.options.map(value => [value, value])) {
        input.add(new Option(text, value));
      }
    }
    wrapper.append(label, input);
    if (field.help) {
      const help = document.createElement("p");
      help.id = field.key + "-help";
      help.className = "field-help";
      help.textContent = field.help;
      input.setAttribute("aria-describedby", help.id);
      wrapper.append(help);
    }
    document.querySelector(`[data-fields="${field.section}"]`).append(wrapper);
    input.addEventListener("input", () => {
      input.setCustomValidity("");
      input.removeAttribute("aria-invalid");
    });
  }

  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }

  function validate() {
    for (const field of schema.fields) {
      const input = form.elements.namedItem(field.key);
      input.setCustomValidity("");
      input.removeAttribute("aria-invalid");
      if (field.type === "file" && input.files[0]) {
        const file = input.files[0];
        if (!/\.(pdf|docx?)$/i.test(file.name) || !file.size || file.size > schema.maxFileBytes) {
          input.setCustomValidity("Choose a non-empty PDF or Word file of 5 MB or less.");
        }
      }
    }
    if (form.elements.phone.value.trim() && !form.elements.phoneCountry.value) {
      form.elements.phoneCountry.setCustomValidity("Select the country for your phone number.");
    }
    const invalid = [...form.elements].find(input => input.willValidate && !input.validity.valid);
    if (invalid) {
      invalid.closest("details")?.setAttribute("open", "");
      invalid.setAttribute("aria-invalid", "true");
      message("Please check the highlighted field before submitting.", true);
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    return true;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(",")[1] });
      reader.onerror = () => reject(new Error("Could not read the attachment. Please select it again."));
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!submissionConfigured) {
      message("This is a preview. Submissions are not available yet, and nothing has been sent.", true);
      return;
    }
    if (busy || fields.disabled || !validate()) return;
    if (!token) { message("Please complete the security check before submitting.", true); return; }
    busy = true;
    fields.disabled = true;
    submit.disabled = true;
    submit.textContent = "Submitting...";
    form.setAttribute("aria-busy", "true");
    message("Sending your application and attachments. Please keep this page open.");
    let timer;
    try {
      const values = {}, files = {};
      for (const field of schema.fields) {
        const input = form.elements.namedItem(field.key);
        if (field.type === "file") {
          if (input.files[0]) files[field.key] = await readFile(input.files[0]);
        } else values[field.key] = input.value.trim();
      }
      try { sessionStorage.setItem(storageKey, requestId); } catch (_) { /* No applicant data is stored. */ }
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 120000);
      // A simple POST avoids Apps Script's unsupported CORS preflight. Never use no-cors:
      // an opaque response cannot prove that Monday received an application.
      const response = await fetch(config.endpoint, {
        method: "POST", credentials: "omit", redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ role: schema.role, requestId, values, files, token, website: form.elements.website.value }),
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || result.requestId !== requestId || typeof result.ok !== "boolean") throw new Error("Unconfirmed response");
      if (!result.ok) {
        message(result.message + "\nReference: " + requestId, true);
        for (const key of result.fields || []) {
          const input = form.elements.namedItem(key);
          if (input) { input.closest("details")?.setAttribute("open", ""); input.setAttribute("aria-invalid", "true"); }
        }
        status.focus();
        return;
      }
      form.reset();
      form.hidden = true;
      const success = document.querySelector("#application-success");
      document.querySelector("#application-receipt").textContent = "Application reference: " + requestId;
      success.hidden = false;
      success.focus();
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* Storage is optional. */ }
    } catch (_) {
      message("We could not confirm your submission. Your answers are still on this page. You can retry without changing them; the same reference prevents a duplicate application. If this continues, contact operations@canton.foundation with reference " + requestId + ".", true);
      status.focus();
    } finally {
      clearTimeout(timer);
      busy = false;
      fields.disabled = false;
      submit.disabled = false;
      submit.textContent = "Submit application";
      form.removeAttribute("aria-busy");
      token = "";
      if (widget !== undefined && window.turnstile) window.turnstile.reset(widget);
    }
  });

  // Show the native questions even before deployment, without collecting a draft.
  fields.disabled = false;
  if (!submissionConfigured) return;
  document.querySelector("#application-unavailable").hidden = true;
  document.querySelector("#application-form-intro").textContent = "Fields marked * are required. Please have your CV ready. Your application is submitted to the Canton Foundation's recruitment system.";
  form.removeAttribute("autocomplete");
  submit.disabled = false;
  submit.textContent = "Submit application";
  submit.removeAttribute("aria-describedby");
  window.onJobVerificationReady = () => {
    widget = window.turnstile.render("#application-verification", {
      sitekey: config.turnstileSiteKey, action: "job_application", theme: "dark",
      callback: value => { token = value; },
      "expired-callback": () => { token = ""; },
      "error-callback": () => { token = ""; message("The security check could not load. Please refresh the page and try again.", true); }
    });
  };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onJobVerificationReady&render=explicit";
  script.async = true;
  script.onerror = () => message("The security check could not load. Please refresh the page and try again.", true);
  document.head.append(script);
})();
