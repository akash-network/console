import { expect, test } from "./fixture/base-test";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";

test.describe("Configure deployment — Container-VM (SSH)", () => {
  test.use({ userType: "existing" });

  test("seeds an SSH VM, asks for the public key before a provider is chosen, and generates a key pair", async ({ page }) => {
    test.setTimeout(2 * 60 * 1000);

    const configure = new ConfigureDeploymentPage(page);
    const createAttempts = await configure.blockDeploymentCreation();

    await test.step("the Container-VM card opens configure seeded as a VM and asks for an SSH key up front", async () => {
      await configure.openContainerVm();

      await expect(page).toHaveURL(/\/new-deployment\/configure\?.*vm=true/);
      await expect(configure.sshKeyStep()).toBeVisible();

      await configure.skipSshKeyStep();

      await expect(configure.operatingSystemCard()).toBeVisible();
      await expect(configure.dockerImageInput()).toHaveCount(0);
      await expect(configure.sshPublicKeyInput()).toBeVisible();
    });

    await test.step("the managed distributions are selectable", async () => {
      await expect(configure.distributionSelect()).toContainText("Ubuntu 24.04");

      await configure.selectDistro("Debian 11");
      await expect(configure.distributionSelect()).toContainText("Debian 11");

      await configure.selectDistro("Ubuntu 24.04");
      await expect(configure.distributionSelect()).toContainText("Ubuntu 24.04");
    });

    await test.step("choosing a provider without a key opens the SSH key step instead of an error", async () => {
      await configure.requestQuotes();

      await expect(configure.sshKeyStep()).toBeVisible();
      await expect(configure.sshKeyRequiredError()).toHaveCount(0);
      expect(createAttempts).toHaveLength(0);
    });

    await test.step("generating a key pair in the step downloads it and goes straight on to bids with the VM kept", async () => {
      const download = await configure.generateSshKeys();

      expect(download.suggestedFilename()).toBe("keypair.zip");
      await expect(configure.sshKeyStep()).toHaveCount(0);
      await expect.poll(() => createAttempts.length, { timeout: 15_000 }).toBe(1);
      expect(createAttempts[0]).toContain("SSH_PUBKEY");
      expect(createAttempts[0]).toContain("ubuntu-2404-ssh");
    });
  });

  test("redirects a direct /deploy-linux visit into the container-VM flow", async ({ page }) => {
    const configure = new ConfigureDeploymentPage(page);

    await configure.gotoDeployLinux();

    await expect(page).toHaveURL(/\/new-deployment\/configure\?.*vm=true/);
    await expect(configure.sshKeyStep()).toBeVisible();
    await configure.skipSshKeyStep();
    await expect(configure.operatingSystemCard()).toBeVisible();
  });
});
