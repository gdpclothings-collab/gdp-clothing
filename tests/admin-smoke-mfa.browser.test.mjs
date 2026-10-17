import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { submitMfaCodeAndAwaitAal2 } from "../scripts/admin-smoke-mfa.mjs";

// Synthetic DOM only. The real production smoke still verifies real AAL2.
async function withMfaPage({ fail = false, intervalMs = 1250 }, callback) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const html = [
      '<form id="verify-mfa">',
      '<label for="admin-mfa-code">Authenticator code</label>',
      '<input id="admin-mfa-code" />',
      '<button type="submit" disabled>Verify</button>',
      '</form><div class="text-red-800" id="error"></div>',
      '<h1 id="dashboard" hidden>GDP Commerce Admin</h1>',
      '<script>',
      'window.mfaSubmitCount=0;window.fakeFail=false;window.delay=1200;',
      'const form=document.querySelector("#verify-mfa");',
      'const input=document.querySelector("#admin-mfa-code");',
      'const button=form.querySelector("button[type=submit]");',
      'input.addEventListener("input",()=>button.disabled=input.value.length!==6);',
      'form.addEventListener("submit",event=>{',
      'event.preventDefault();window.mfaSubmitCount++;button.disabled=true;',
      'button.textContent="Verifying…";',
      'setTimeout(()=>{if(window.fakeFail){',
      'document.querySelector("#error").textContent="Invalid MFA code 123456";',
      'button.disabled=false;button.textContent="Verify";',
      '}else{form.remove();document.querySelector("#dashboard").hidden=false;}',
      '},window.delay);});</script>',
    ].join("");
    await page.setContent(html);
    await page.evaluate(({ fail, intervalMs }) => {
      window.fakeFail = fail;
      window.delay = intervalMs;
    }, { fail, intervalMs });
    return await callback(page);
  } finally { await browser.close(); }
}

test("slow verification changes Verify to Verifying; smoke clicks once and waits", async () => {
  await withMfaPage({ intervalMs: 1700 }, async page => {
    await submitMfaCodeAndAwaitAal2(page, "123456", 7000);
    assert.equal(await page.evaluate(() => window.mfaSubmitCount), 1);
    assert.equal(await page.locator("#dashboard").isVisible(), true);
  });
});

test("MFA rejection fails closed and redacts the six-digit code", async () => {
  await withMfaPage({ fail: true }, async page => {
    await assert.rejects(submitMfaCodeAndAwaitAal2(page, "123456", 7000),
      error => /did not complete AAL2/.test(error.message) && !error.message.includes("123456"));
    assert.equal(await page.evaluate(() => window.mfaSubmitCount), 1);
  });
});

test("invalid codes are rejected without submission", async () => {
  await withMfaPage({}, async page => {
    await assert.rejects(submitMfaCodeAndAwaitAal2(page, "1234", 1500), /exactly six digits/);
    assert.equal(await page.evaluate(() => window.mfaSubmitCount), 0);
  });
});
