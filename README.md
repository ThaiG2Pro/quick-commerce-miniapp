# Quick Commerce Zalo Mini App

This is a high-performance Zalo Mini App template for Quick Commerce, built with React, Vite, Tailwind CSS, and ZMP UI.

## 🚀 Getting Started (For New Developers)

If you are new to this project, follow these steps exactly to sync your environment with the team.

### 0. Clone this project :

```bash
# 1. Clone the repository
git clone https://github.com/ThaiG2Pro/quick-commerce-miniapp.git

# 2. Go into the folder

cd quick-commerce-miniapp
```

### 1. Prerequisites & Environment Sync
We use **`mise`** to ensure everyone uses the same version of Node.js and other tools.

1.  **Install mise:** (If you haven't already)
    Follow the [mise installation guide](https://mise.jafnic.com/getting-started.html).
2.  **Sync Runtime:** Inside the project folder, run:
    ```bash
    mise install
    ```
    This will automatically install the correct Node.js version locally for this project.

### 2. Install Zalo Mini App CLI
The official documentation suggests `npm`, but we use **`pnpm`** for better performance:
```bash
pnpm add -g zmp-cli
```

### 3. Setup Project
Follow these commands to get the code and start working:

```bash
# 1. Install dependencies
pnpm install

# 2. Approve build scripts (Required for pnpm v10 security)
pnpm approve-builds @parcel/watcher esbuild

# 3. Create your own branch to start coding (Replace 'your-name' with yours)
git checkout -b feature/your-name-update
```

### 4. Run the App
```bash
pnpm start
```
Open `http://localhost:3000` in your browser to see the app.

---

## 🎨 How to Edit the UI (Beginner's Guide)

If you want to change how the app looks, here is where to look:

| If you want to change... | Look in this folder/file | Impact on UI |
| :--- | :--- | :--- |
| **App Colors/Theme** | `src/css/tailwind.scss` | Changes primary colors (green, background, etc.) |
| **App Title/Header** | `app-config.json` | Changes the top bar title and safe area settings. |
| **Page Layout** | `src/pages/` | Each file here is a full screen (Home, Cart, Profile). |
| **Small Parts (Buttons, Cards)** | `src/components/` | Reusable elements used across different pages. |
| **Navigation/Tabs** | `src/components/navigation.tsx` | Changes the bottom menu tabs. |

**Pro Tip:** This project uses **Tailwind CSS**. You can style elements by adding classes like `className="bg-blue-500 p-4 text-white"` directly to the HTML tags in React.

---

## 🔄 Sync & Deployment

### Method 1: VS Code Extension (Easiest)
1. Install the [Zalo Mini App Extension](https://marketplace.visualstudio.com/items?itemName=vng-zalo.zalo-mini-app-extension).
2. Click the **Zalo icon** on the left sidebar of VS Code.
3. **Login** by scanning the QR code.
4. Select the **App ID** provided by the team.
5. Click **Deploy** to sync your changes to the Zalo platform.

### Method 2: Command Line
```bash
zmp login
zmp deploy
```

---

## ⚠️ Common Fixes Included
- **Sass:** Configured to use `modern-compiler` to avoid deprecation warnings.
- **Tailwind:** Updated to v3 `content` format.
- **Vite:** Root directory fixed to `./` so `index.html` is found correctly.
