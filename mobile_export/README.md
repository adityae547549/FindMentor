# FindMentor Native App

This folder contains the native app configuration for FindMentor.

## How to use

1. **Move this folder** to your desired location (e.g., a new project folder).
   
2. **Open a terminal** in this folder.

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Add Android Platform**:
   ```bash
   npx cap add android
   ```
   *(Make sure you have Android Studio installed)*

5. **Run on Android**:
   ```bash
   npx cap run android
   ```
   Or open in Android Studio:
   ```bash
   npx cap open android
   ```

## Updating the App

If you make changes to the web code (html/css/js):
1. Copy the updated files into the `www` folder.
2. Run:
   ```bash
   npx cap sync
   ```
