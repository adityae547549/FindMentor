# FindMentor Testing Instructions

## 1. Prerequisites
- Ensure Node.js is installed.
- Ensure you have the `server.js` running.

```bash
cd backend
node server.js
```

## 2. Testing Video Calls (Mentor & Student)

### Setup
1. Open two different browsers (or one Incognito window).
2. **Browser A (Student):**
   - Go to `http://localhost:3000/frontend/login.html` (or `index.html`).
   - Login as a **Student**.
   - Navigate to the Dashboard.

3. **Browser B (Mentor):**
   - Go to `http://localhost:3000/frontend/login.html`.
   - Login as a **Mentor**.
   - Navigate to the Mentor Dashboard.

### Initiating a Call (Student)
1. On the Student Dashboard, find the "Available Mentors" section.
2. Click the **Video Call** button next to an online Mentor.
   - *Note: If the mentor is offline, you will see a toast notification.*
3. A "Request Sent" toast should appear.
4. The button text may change to "Request Pending".

### Accepting a Call (Mentor)
1. On the Mentor Dashboard, wait for the **Incoming Video Call** modal to appear.
2. Click **Accept**.
3. You will be redirected to the video call room.

### During the Call
1. **Permissions:** Allow Camera and Microphone access when prompted.
2. **Controls:**
   - **Mute/Unmute:** Click the microphone icon.
   - **Video On/Off:** Click the camera icon.
   - **Switch Camera:** Click the rotate camera icon (mobile only/if multiple cameras exist).
   - **End Call:** Click the red phone icon.
3. **Chat:**
   - Click the chat icon to open the side panel.
   - Send a message. Verify the other peer receives it.

## 3. Testing AI Features
1. Go to the Dashboard (Student or Mentor).
2. Click the **AI Companion** button (or "Ask AI").
3. **Mobile Test:**
   - Resize browser to mobile width (< 768px).
   - Verify the "Hamburger" menu appears top-left.
   - Click it to toggle the sidebar history.
4. **Chat:**
   - Type a message in the input box.
   - Press Send.
   - Verify the AI responds (simulated or real if API key is set).

## 4. Testing Responsiveness (WebView Check)
1. Open Developer Tools (F12) -> Toggle Device Toolbar (Mobile view).
2. Select "iPhone 12/13" or "Pixel 5".
3. **Navigate through:**
   - Login / Signup
   - Dashboard
   - Settings
   - Video Call
4. **Verify:**
   - No horizontal scrolling.
   - Buttons are clickable and sized correctly.
   - Text is readable.
   - Input fields are accessible (not hidden by keyboard/bottom of screen).

## 5. Troubleshooting
- **Camera/Mic Error:** Ensure `localhost` is treated as secure or use HTTPS (ngrok recommended for real mobile testing).
- **"User not found":** Ensure you are logged in and your user document exists in Firestore.
- **Connection Issues:** Check if `server.js` is running and Socket.io is connected (check browser console for "Connected to socket server").
