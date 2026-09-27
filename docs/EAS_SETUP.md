# Building & submitting the iOS app (EAS)

EAS (Expo Application Services) is the service that turns this React Native code into an actual
signed iOS app and can send it straight to the App Store. This step needs to run from **your own
Mac**, not from a Claude session — it involves logging into your personal Expo and Apple accounts,
and Claude Code sessions can't do interactive logins on your behalf.

Everything below is meant to be followed even if you've never used Terminal before.

## Before you start

- **A free Expo account.** Go to https://expo.dev/signup in your browser and sign up (email +
  password is fine).
- **An Apple Developer Program membership** ($99/year) — required before you can submit to the App
  Store, though you can do test builds without it. Sign up at https://developer.apple.com/programs/
  if you haven't already. Approval can take a day or two, so it's worth starting this early.
- **Node.js installed on your Mac.** If you're not sure, open Terminal (press `Cmd + Space`, type
  `Terminal`, press Enter) and type `node -v`. If it prints a version number, you're set. If it
  says "command not found," install Node from https://nodejs.org (choose the "LTS" version) first.

## One-time setup

Open Terminal and run these commands one at a time, pressing Enter after each and waiting for it
to finish before typing the next:

```bash
# 1. Get the code onto your Mac (skip if you already have a local copy)
git clone https://github.com/qualityworks25-droid/black-excellence-trivia.git
cd black-excellence-trivia/mobile

# 2. Install the app's dependencies
npm install

# 3. Log into your Expo account (opens your browser to sign in)
npx eas-cli login

# 4. Link this project to your Expo account — this fills in the real project ID
npx eas-cli init
```

After step 4, open `mobile/app.json` in any text editor and check that `extra.eas.projectId` is no
longer a "TODO" placeholder — `eas init` fills it in automatically.

Then set your app's final identity, also in `mobile/app.json`:
- `owner`: your Expo username (replace the "TODO-your-expo-username" placeholder)
- `ios.bundleIdentifier`: a unique reverse-domain ID you choose now and never change later, e.g.
  `com.yourname.blackexcellencetrivia`

## Building the app

Still in the `mobile` folder in Terminal:

```bash
# A quick internal test build (good for checking things work before going further)
npm run build:ios:preview

# The real production build meant for the App Store
npm run build:ios
```

The first time you run a build, EAS will ask if it should manage your Apple signing credentials
automatically — say yes. It will ask you to log into your Apple Developer account right there in
Terminal. EAS handles creating the certificates and provisioning profiles for you; you don't need
to open Xcode at all.

The build itself runs on Expo's servers, not your Mac — it'll print a link where you can watch its
progress and download the finished build once it's done (usually 10-20 minutes).

## Submitting to the App Store

Once you have a production build:

```bash
npm run submit:ios
```

This uploads the build directly to App Store Connect. It'll ask for your Apple ID and either an
app-specific password or an API key — follow the prompts, it explains each one as you go.

From there, finish the listing at https://appstoreconnect.apple.com :
1. Create the app record (name, bundle ID, primary language).
2. Fill in the store listing: description, screenshots, category, age rating.
3. Add a **privacy policy URL** — Apple requires this since the app collects profile/stats data.
4. Add the uploaded build under the "TestFlight" tab and test it yourself first.
5. When ready, submit that build for **App Review**.

A note for review: Apple's reviewers need to be able to actually play a match. Since this is a
multiplayer game, it's worth adding a solo/practice mode or a demo account before submitting, or
reviewers may reject the build for not being able to test core functionality.
