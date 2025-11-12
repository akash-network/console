"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sshKeyUtils_1 = require("./sshKeyUtils");
describe(sshKeyUtils_1.generateSSHKeyPair.name, function () {
    it("generates a valid SSH key pair", function () {
        var _a = (0, sshKeyUtils_1.generateSSHKeyPair)(), publicKey = _a.publicKey, privateKey = _a.privateKey, publicPem = _a.publicPem, privatePem = _a.privatePem;
        expect(publicKey).toBeTruthy();
        expect(privateKey).toBeTruthy();
        expect(publicPem).toBeTruthy();
        expect(privatePem).toBeTruthy();
        expect(publicKey).toMatch(/^ssh-rsa\s+[A-Za-z0-9+/=]+\s+user@host$/);
        expect(privateKey).toContain("-----BEGIN RSA PRIVATE KEY-----");
        expect(privateKey).toContain("-----END RSA PRIVATE KEY-----");
    });
    it("generates different keys on each call", function () {
        var keyPair1 = (0, sshKeyUtils_1.generateSSHKeyPair)();
        var keyPair2 = (0, sshKeyUtils_1.generateSSHKeyPair)();
        expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
        expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
    });
});
describe(sshKeyUtils_1.rsaPublicKeyToOpenSSH.name, function () {
    it("converts PEM to OpenSSH format with default comment", function () {
        var publicPem = (0, sshKeyUtils_1.generateSSHKeyPair)().publicPem;
        var opensshKey = (0, sshKeyUtils_1.rsaPublicKeyToOpenSSH)(publicPem);
        expect(opensshKey).toMatch(/^ssh-rsa\s+[A-Za-z0-9+/=]+\s+user@host$/);
    });
    it("converts PEM to OpenSSH format with custom comment", function () {
        var publicPem = (0, sshKeyUtils_1.generateSSHKeyPair)().publicPem;
        var customComment = "test@example.com";
        var opensshKey = (0, sshKeyUtils_1.rsaPublicKeyToOpenSSH)(publicPem, customComment);
        expect(opensshKey).toMatch(new RegExp("^ssh-rsa\\s+[A-Za-z0-9+/=]+\\s+".concat(customComment, "$")));
    });
    it("produces consistent output for the same PEM", function () {
        var publicPem = (0, sshKeyUtils_1.generateSSHKeyPair)().publicPem;
        var opensshKey1 = (0, sshKeyUtils_1.rsaPublicKeyToOpenSSH)(publicPem);
        var opensshKey2 = (0, sshKeyUtils_1.rsaPublicKeyToOpenSSH)(publicPem);
        expect(opensshKey1).toBe(opensshKey2);
    });
});
