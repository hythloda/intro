/* Shared local validation; never log, store, or send numbers to a lookup service. */
var JOB_APPLICATION_PHONE = {
  validate: function (value, country) {
    var invalid = function (message, fields) { return { ok: false, message: message, fields: fields }; };
    value = typeof value === "string" ? value.trim() : "";
    if (!value) return { ok: true, number: "" };
    if (!country) return invalid("Select the country for your phone number, or leave the optional phone field empty.", ["phoneCountry"]);
    if (typeof libphonenumber === "undefined") return invalid("Phone validation is unavailable. Please try again later or leave the optional phone field empty.", ["phone"]);
    if (JOB_APPLICATION_SCHEMA.countryCodes.indexOf(country) === -1 || !libphonenumber.isSupportedCountry(country)) {
      return invalid("Select a supported country for your phone number, or leave the optional phone field empty.", ["phoneCountry"]);
    }
    var message = "Enter a valid phone number for the selected phone country, including the area code. You can also leave this optional field empty.";
    // Do not extract a number from surrounding text or silently discard extensions.
    if (value.length > 40 || !/^\+?[0-9 ()\-.]+$/.test(value)) return invalid(message, ["phone"]);
    try {
      var phone = libphonenumber.parsePhoneNumberFromString(value, { defaultCountry: country, extract: false });
      if (!phone || phone.ext || !phone.isValid()) return invalid(message, ["phone"]);
      if (phone.countryCallingCode !== libphonenumber.getCountryCallingCode(country) || (phone.country && phone.country !== country)) {
        return invalid("The phone number does not match the selected phone country. Check both fields or leave the optional phone field empty.", ["phone", "phoneCountry"]);
      }
      return { ok: true, number: phone.number };
    } catch (_) {
      return invalid(message, ["phone"]);
    }
  }
};
