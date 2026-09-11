import { expect, test } from "./fixture/base-test";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";

test.describe("Configure deployment — Container-VM (SSH)", () => {
  test.use({ userType: "existing" });

  test("seeds an SSH VM, gates submission on the public key, and generates a key pair", async ({ page }) => {
    test.setTimeout(2 * 60 * 1000);

    const configure = new ConfigureDeploymentPage(page);
    const createAttempts = await configure.blockDeploymentCreation();

    await test.step("the Container-VM card opens configure seeded as a VM", async () => {
      await configure.openContainerVm();

      await expect(page).toHaveURL(/\/new-deployment\/configure\?.*vm=true/);
      await expect(configure.operatingSystemCard()).toBeVisible();
      await expect(configure.dockerImageInput()).toHaveCount(0);
      await expect(configure.exposeSshCheckbox()).toBeChecked();
      await expect(configure.exposeSshCheckbox()).toBeDisabled();
    });

    await test.step("the managed distributions are selectable", async () => {
      await expect(configure.distributionSelect()).toContainText("Ubuntu 24.04");

      await configure.selectDistro("Debian 11");
      await expect(configure.distributionSelect()).toContainText("Debian 11");

      await configure.selectDistro("Ubuntu 24.04");
      await expect(configure.distributionSelect()).toContainText("Ubuntu 24.04");
    });

    await test.step("requesting quotes without a key is rejected before any deployment is created", async () => {
      await configure.requestQuotes();

      await expect(configure.sshKeyRequiredError()).toBeVisible();
      expect(createAttempts).toHaveLength(0);
    });

    await test.step("generating a key pair downloads it and fills the key field", async () => {
      const download = await configure.generateSshKeys();

      expect(download.suggestedFilename()).toBe("keypair.zip");
      await expect(configure.sshPublicKeyInput()).toHaveValue(/^ssh-rsa /);
      await expect(configure.sshKeyRequiredError()).toHaveCount(0);
    });

    await test.step("the generated key and the VM image reach the submitted spec", async () => {
      await configure.requestQuotes();

      await expect.poll(() => createAttempts.length, { timeout: 15_000 }).toBe(1);
      expect(createAttempts[0]).toContain("SSH_PUBKEY");
      expect(createAttempts[0]).toContain("ubuntu-2404-ssh");
    });
  });

  test("redirects a direct /deploy-linux visit into the container-VM flow", async ({ page }) => {
    const configure = new ConfigureDeploymentPage(page);

    await configure.gotoDeployLinux();

    await expect(page).toHaveURL(/\/new-deployment\/configure\?.*vm=true/);
    await expect(configure.operatingSystemCard()).toBeVisible();
  });
});
