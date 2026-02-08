# Publishing CineSnap to the Mac App Store (MAS)

This guide outlines the steps to build and publish CineSnap for the Mac App Store.

## Prerequisites

1.  **Apple Developer Program Membership**: You must have an active Apple Developer account ($99/year).
2.  **Xcode**: Install Xcode from the Mac App Store.
3.  **Certificates**: You need specific signing certificates.

## 1. Certificates & Provisioning Profiles

Log in to [developer.apple.com](https://developer.apple.com/account/resources/certificates/list) and generate:

1.  **Mac App Distribution**: For signing the app itself.
2.  **Mac Installer Distribution**: For signing the `.pkg` installer.
3.  **Mac Provisioning Profile**: Create a Distribution profile for the App Store, selecting your App ID (`com.vec.cinesnap`).

Download and install these into your Keychain.

## 2. Configuration (`electron-builder.yml`)

Ensure your `electron-builder.yml` has the `mas` (Mac App Store) target configured.

```yaml
mas:
  type: distribution
  category: public.app-category.video
  entitlements: build/entitlements.mas.plist
  entitlementsInherit: build/entitlements.mas.inherit.plist
  provisioningProfile: "path/to/embedded.provisionprofile"
```

*Note: You may need to create the entitlement files in `build/` if they don't exist.*

**`build/entitlements.mas.plist`**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.bookmarks.app-scope</key>
    <true/>
  </dict>
</plist>
```

## 3. Build & Sign

Run the build command:

```bash
npm run build:mac
```
*Note: You might need to add a specific script in `package.json` for MAS builds if your default build targets `.dmg`.*

For MAS, you typically run:
```bash
electron-builder build --mac mas
```

## 4. Upload via Transporter

1.  Download **Transporter** app from the Mac App Store.
2.  Log in with your Apple ID.
3.  Drag the generated `.pkg` file (from `dist/mas/`) into Transporter.
4.  Click **Deliver**.

## 5. App Store Connect

1.  Go to [App Store Connect](https://appstoreconnect.apple.com).
2.  Create a new macOS App with the Bundle ID `com.vec.cinesnap`.
3.  Fill in the metadata (Screenshots, Description, Keywords).
    - **Keywords**: Log Viewer, S-Log3, Color Grading, LUT, Video Preview, Snapshot.
    - **Category**: Photo & Video / Video.
4.  Select the build you uploaded via Transporter.
5.  **Pricing and Availability**:
    - Go to **Pricing and Availability**.
    - Under **Price Schedule**, select the **Price Tier** for **$19.99** (typically **Tier 20**).
    - Ensure "No End Date" is selected.
    - **Do NOT** create any "In-App Purchases" or "Subscriptions". This ensures it is a simple one-time fee.
6.  Submit for Review.

## Troubleshooting

- **Sandbox Errors**: If the app crashes immediately, check your `plain` entitlements. The app must be sandboxed for MAS.
- **Asset Validation**: Ensure you don't use private APIs. Electron is generally safe, but verify plugin usage.
