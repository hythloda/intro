# libphonenumber-js 1.13.14

Vendored, unmodified `bundle/libphonenumber-max.js`, `LICENSE`, `LICENSE.Apache`,
and `AUTHORS` from the published `libphonenumber-js` npm package.

- Source: https://gitlab.com/catamphetamine/libphonenumber-js
- Package: https://registry.npmjs.org/libphonenumber-js/-/libphonenumber-js-1.13.14.tgz
- Package integrity: `sha512-llihgCcx0BFLksecLP+x1J+6JDE1GsXS1RN/LoPF6qcwpeQcnjj0lcvZxY8AzbEpYwyZWPZW/nDuqkqzm3amiw==`

The full metadata bundle validates national phone numbers locally. Neither the
browser nor Apps Script sends phone numbers to a validation service. The Apps
Script build embeds the same bundle and license notices in its single `Code.gs`.
Update this pinned dependency periodically as numbering plans change, verify the
package integrity, rebuild `Code.gs`, and run the job-application tests.
