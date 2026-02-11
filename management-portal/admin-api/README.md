# Admin API Deployment Instructions

This directory contains the code for your Private Property & Lead Management API.

## 1. Create Google Apps Script Project
1.  Go to [script.google.com](https://script.google.com/home).
2.  Click **New Project**.
3.  Name it: `Property Management Admin API`.

## 2. Copy Code
1.  Copy the content of `Code.js` into the `Code.gs` file in the editor (replace existing code).
2.  Create a new Script file named `AwsSignature` and copy the content of `AwsSignature.js` into it.

## 3. Set Project Properties (Secrets)
1.  Click on the **Project Settings** (Gear icon ⚙️) on the left sidebar.
2.  Scroll down to **Script Properties**.
3.  Click **Edit script properties** > **Add script property**.
4.  Add the following keys and values:
    -   `AWS_ACCESS_KEY`: *Your IAM User Access Key*
    -   `AWS_SECRET_KEY`: *Your IAM User Secret Key*
    -   `AWS_BUCKET_NAME`: *Your S3 Bucket Name* (e.g., `medable-property-management`)
    -   `AWS_REGION`: *Your Region* (e.g., `us-east-1`)
    -   `SHEET_ID_LISTING`: *ID of the Property Listings Sheet*
    -   `SHEET_ID_LEAD`: *ID of the Lead Management Sheet*
    -   `SHEET_ID_AUTH`: *ID of the Users/Auth Sheet*
    -   `JWT_SECRET`: *A random long string (e.g. 'y0ur-5ecr3t-k3y')*

## 4. Setup Google Sheet
Ensure your Google Sheet has a tab named **"Users"** with these exact headers in Row 1:
-   `id`
-   `name`
-   `email`
-   `password_hash`
-   `role`
-   `active`
-   `token`
-   `token_expiry`

*Add yourself manually to the first row (e.g., id:1, active:TRUE, role:admin).*

## 5. Deploy
1.  Click **Deploy** > **New deployment**.
2.  Select type: **Web app**.
3.  Description: `v1`.
4.  **Execute as**: `Me` (your account).
5.  **Who has access**: `Anyone`. *Important: The script handles security itself via tokens. "Anyone" is required so the mobile app can call it without Google Sign-In popup.*
6.  Click **Deploy**.
7.  **Copy the Web App URL**. You will need this for the Mobile App configuration.

## Local Development

I have completed the core implementation of the Hybrid Architecture. Here is a summary of what's ready for you:

### 🚀 Components Built

1.  **Backend Admin API** (`/management-portal/admin-api`):
    -   Secure JWT-based authentication.
    -   Lead management (List + 24-hour Exclusivity Lock).
    -   Property management (List + Edit).
    -   S3 Presigned URL generator for secure photo uploads.
2.  **Mobile App** (`/management-portal/mobile-app`):
    -   Built with **Expo (React Native)** for Web, iOS, and Android.
    -   Styled with **NativeWind (Tailwind CSS)** for a premium look.
    -   Complete User Auth flow.
    -   Integrated S3 image picker and uploader.

### 🛠️ How to Test

#### Phase 1: Backend Deployment
Follow the instructions above to:
1.  Deploy the Apps Script.
2.  Set up the **Users** sheet manually with at least one agent (active: TRUE).
3.  **Copy the Web App URL**.

#### Phase 2: Mobile App Setup
1.  Open `/management-portal/mobile-app/constants/Config.ts`.
2.  Replace `CHANGEME` in `ADMIN_API_URL` with your actual Web App URL.
3.  In your terminal, navigate to the mobile app folder:
    ```bash
    cd management-portal/mobile-app
    npx expo start
    ```
4.  Open it in your browser (press `w`) or on your phone via the **Expo Go** app.

### ✅ Verification Checklist

- [ ] **Login**: Sign in using the email/password you added to the Users sheet.
- [ ] **Leads**: Go to the Leads tab. Try to "Pick" a lead. Verify it shows as "Locked" and your name is assigned.
- [ ] **Property Detail**: Go to the Properties tab. Tap a property to see the full details.
- [ ] **Image Upload**: Tap the "Edit" (pencil) icon on a property. Tap the "Camera" icon to pick a photo. Verify it uploads to S3 and updates the thumbnail.

### 📸 Screen Previews

| Login | Properties | Leads | Edit |
| :--- | :--- | :--- | :--- |
| ![Login UI](/Users/anas-medable/.gemini/antigravity/brain/d44e0b71-2c86-4fc4-b9ee-c1e57db062cf/mobile_login_ui_1768107092871.png) | ![Properties UI](/Users/anas-medable/.gemini/antigravity/brain/d44e0b71-2c86-4fc4-b9ee-c1e57db062cf/mobile_properties_ui_1768107108765.png) | ![Leads UI](/Users/anas-medable/.gemini/antigravity/brain/d44e0b71-2c86-4fc4-b9ee-c1e57db062cf/mobile_leads_ui_1768107122964.png) | ![Edit UI](/Users/anas-medable/.gemini/antigravity/brain/d44e0b71-2c86-4fc4-b9ee-c1e57db062cf/mobile_edit_ui_1768107139898.png) |

> [!IMPORTANT]
> Since this is a hybrid app, you can run it on the web immediately to verify the UI and logic, but for the full experience, using the Expo Go app on a physical device is recommended for testing the camera/library features.

