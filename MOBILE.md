# FindMentor Mobile App

This project uses [Capacitor](https://capacitorjs.com/) to build a native Android app from the web frontend.

## Prerequisites

- Node.js installed.
- **Android Studio** installed (for Android build).
- Android SDK installed via Android Studio.

## Setup

The project is already configured with Capacitor.

1.  **Install dependencies** (if not done):
    ```bash
    npm install
    ```

## Building the App

To build the mobile app, follow these steps:

1.  **Prepare the web assets**:
    This script copies the frontend files to the `www` directory.
    ```bash
    npm run build:mobile
    ```

2.  **Sync with Capacitor**:
    This updates the native Android project with the latest web assets and plugins.
    ```bash
    npx cap sync
    ```

3.  **Open in Android Studio**:
    This command opens the `android` folder in Android Studio.
    ```bash
    npx cap open android
    ```

## Running in Android Studio

1.  Once Android Studio opens, wait for Gradle sync to finish.
2.  Connect an Android device via USB or create an Emulator (AVD).
3.  Click the **Run** button (green play icon) in the toolbar.

## Permissions

The app requests the following permissions for Video Call and File Upload features:
- Camera
- Microphone
- Audio Settings
- Storage (Read/Write)

These are configured in `android/app/src/main/AndroidManifest.xml`.

## Troubleshooting

- **Cleartext Traffic**: If you change the API URL to `http` (non-secure), you may need to enable `usesCleartextTraffic` in `AndroidManifest.xml`. Currently, it uses the production HTTPS URL.
- **Gradle Errors**: Ensure you have the latest Android SDK and Command Line Tools installed via Android Studio SDK Manager.
