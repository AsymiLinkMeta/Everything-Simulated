import { test as setup } from "@playwright/test";
import { ROLES, authFile, login } from "./fixtures";

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await login(page, role);
    await page.context().storageState({ path: authFile(role) });
  });
}
