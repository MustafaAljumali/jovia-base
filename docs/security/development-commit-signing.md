---
document: Development Commit Signing
version: 1.0.0
status: Approved
authority: Security Operations Procedure
ai_context: Read Before Configuring Git Signing
read_before:
  - Jovia_Engineering_Constitution_v2.0.md
  - docs/adr/ADR-0001-production-monorepo-foundation.md
read_after: []
owner: Jovia Core Team
last_revised: 2026-08-04
last_verified: 2026-08-04
---

# Development Commit Signing

## Purpose

This procedure records how commits created on the dedicated Jovia development
device are signed without placing private material in the repository. It
implements the Engineering Constitution requirement that commits use GPG or SSH
signing for non-repudiation.

## Registered Key Identity

- Algorithm: Ed25519
- Purpose: Git commit and tag signing for the Jovia development repository
- Fingerprint: `SHA256:fXTH+W+yI0v8loV+QrzQysM0CVVGrR0eZjMf2Y2X074`
- Created: 2026-08-04
- Scope: this development device and the `MustafaAljumali/jovia-base` repository

The private key, passphrase, DPAPI-protected secret blob, and public-key body are
not stored in this repository. Only the fingerprint is an approved repository
record.

## Device Setup Procedure

1. Generate a dedicated Ed25519 key with a strong random passphrase and a high
   key-derivation round count. Do not reuse deployment, infrastructure, personal
   login, or production automation keys.
2. Store the private key under the Windows user `.ssh` directory with inherited
   ACLs removed and access limited to the owning Windows identity.
3. Protect the randomly generated passphrase using Windows Data Protection API
   with `CurrentUser` scope. The clear passphrase must exist only in process
   memory while the key is created or used.
4. Restrict the signing helper and protected passphrase blob to the same Windows
   identity. The helper may decrypt the passphrase only to answer the local
   `ssh-keygen` signing prompt.
5. Register the public key in the owning GitHub account as an **SSH signing key**,
   not as an authentication key.
6. Configure the repository with:

   ```text
   gpg.format=ssh
   user.signingkey=<device-local-private-key-path>
   gpg.ssh.program=<device-local-OpenSSH-ssh-keygen-path>
   commit.gpgsign=true
   tag.gpgsign=true
   ```

   Automated development tooling supplies the DPAPI-backed askpass helper to
   OpenSSH through the process environment; the helper path and protected secret
   remain device-local.
7. Create a signed commit, push its review branch, and confirm GitHub displays the
   commit as **Verified** before treating setup as complete.

## Verification Procedure

Confirm the local public-key fingerprint:

```powershell
ssh-keygen -lf "$env:USERPROFILE\.ssh\jovia_ed25519_signing.pub" -E sha256
```

Confirm repository signing enforcement without displaying secret material:

```powershell
git config --local --get gpg.format
git config --local --get commit.gpgsign
git config --local --get tag.gpgsign
git config --local --get user.signingkey
```

After committing, verify that Git recorded an SSH signature and compare the
fingerprint with the registered fingerprint. GitHub's **Verified** badge is the
authoritative remote registration check.

## Rotation and Revocation

Revoke the GitHub signing key immediately if the device, Windows account,
private-key file, protected passphrase blob, or signing helper may be compromised.
Generate a new dedicated key, register only its public half, update the fingerprint
in this document through a signed security commit, and remove the revoked public
key from GitHub. Historical signatures remain attributable to the previously
registered fingerprint.

## Prohibited Actions

- Never print, transmit, upload, commit, back up with the repository, or paste the
  private key.
- Never commit the passphrase, protected passphrase blob, signing helper, or local
  key paths as executable repository configuration.
- Never register the private key anywhere.
- Never use this key for production deployment, infrastructure access, SSH login,
  or application runtime authentication.
- Never disable mandatory signing to bypass a failed local setup.
