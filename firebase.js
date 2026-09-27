
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  initializeFirestore,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBYXdYux_sL2R0TV1BEegRwT6hMkyfg6mY",
  authDomain: "evermore-2012.firebaseapp.com",
  projectId: "evermore-2012",
  storageBucket: "evermore-2012.firebasestorage.app",
  messagingSenderId: "601269409067",
  appId: "1:601269409067:web:529871f3573b39ff09a16e",
  measurementId: "G-4J0NZ3BFF5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Firestore with long-polling transport
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

const $ = (id) => document.getElementById(id);

// Friendly error messages
function getErrorMessage(code) {
  const errors = {
    "auth/email-already-in-use":
      "This email is already registered.",
    "auth/invalid-email":
      "Please enter a valid email address.",
    "auth/weak-password":
      "Password must be at least 8 characters.",
    "auth/invalid-credential":
      "Incorrect email or password.",
    "auth/network-request-failed":
      "Network error. Check your internet connection.",
    "auth/too-many-requests":
      "Too many attempts. Please try again later.",
    "auth/operation-not-allowed":
      "Email/Password sign-in is not enabled in Firebase.",
    "permission-denied":
      "Database access denied. Please check Firestore rules."
  };

  return errors[code] || "Something went wrong. Please try again.";
}

// REGISTRATION
const registerForm = $("register-form");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = $("username").value.trim();
    const usernameLower = username.toLowerCase();
    const email = $("email").value.trim();
    const password = $("password").value;
    const confirmPassword = $("confirm-password").value;
    const message = $("register-message");
    const button = registerForm.querySelector(
      "button[type='submit']"
    );

    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      message.textContent =
        "Username must be 3–20 characters: letters, numbers, or underscores.";
      return;
    }

    if (password.length < 8) {
      message.textContent =
        "Password must be at least 8 characters.";
      return;
    }

    if (password !== confirmPassword) {
      message.textContent = "Passwords do not match.";
      return;
    }

    button.disabled = true;
    message.textContent = "Creating your account...";

    let createdUser = null;

    try {
      // Create the Firebase Authentication account
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      createdUser = credential.user;

      // Reserve username and create profile atomically
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(
          db,
          "usernames",
          usernameLower
        );

        const userRef = doc(
          db,
          "users",
          createdUser.uid
        );

        const usernameSnapshot =
          await transaction.get(usernameRef);

        if (usernameSnapshot.exists()) {
          throw new Error("USERNAME_TAKEN");
        }

        transaction.set(usernameRef, {
          uid: createdUser.uid,
          username: username
        });

        transaction.set(userRef, {
          uid: createdUser.uid,
          username: username,
          usernameLower: usernameLower,
          email: email,
          createdAt: serverTimestamp()
        });
      });

      message.textContent = "Account created successfully!";
      window.location.replace("home.html");

    } catch (error) {
      console.error(error);

      // Remove the newly created Auth account if
      // username reservation or profile creation fails
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (deleteError) {
          console.error(
            "Account cleanup failed:",
            deleteError
          );
        }
      }

      if (error.message === "USERNAME_TAKEN") {
        message.textContent =
          "That username is already taken. Choose another.";
      } else {
        message.textContent = getErrorMessage(error.code);
      }

      button.disabled = false;
    }
  });
}

// LOGIN
const loginForm = $("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("email").value.trim();
    const password = $("password").value;
    const message = $("login-message");
    const button = loginForm.querySelector(
      "button[type='submit']"
    );

    button.disabled = true;
    message.textContent = "Signing in...";

    try {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      window.location.replace("home.html");

    } catch (error) {
      console.error(error);
      message.textContent = getErrorMessage(error.code);
      button.disabled = false;
    }
  });
}

// AUTHENTICATION PROTECTION
const protectedPages = [
  "home.html",
  "chats.html",
  "groups.html",
  "profile.html"
];

onAuthStateChanged(auth, async (user) => {
  const currentPage = window.location.pathname
    .split("/")
    .pop();

  const isProtectedPage =
    protectedPages.includes(currentPage);

  if (!user && isProtectedPage) {
    window.location.replace("index.html");
    return;
  }

  if (user && (
    currentPage === "index.html" ||
    currentPage === "register.html" ||
    currentPage === ""
  )) {
    window.location.replace("home.html");
    return;
  }

  if (!user) return;

  // Load profile details from Firestore
  try {
    const userRef = doc(db, "users", user.uid);

    const { getDoc } = await import(
      "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
    );

    const profileSnapshot = await getDoc(userRef);

    if (profileSnapshot.exists()) {
      const profile = profileSnapshot.data();

      const username = profile.username || "User";
      const initial = username.charAt(0).toUpperCase();

      const profileName = $("profile-name");
      const profileAvatar = $("profile-avatar");
      const homeAvatar = $("home-avatar");

      if (profileName) {
        profileName.textContent = username;
      }

      if (profileAvatar) {
        profileAvatar.textContent = initial;
      }

      if (homeAvatar) {
        homeAvatar.textContent = initial;
      }
    }
  } catch (error) {
    console.error("Profile loading failed:", error);
  }
});

/* =================================
   EVERMORE — FIND PEOPLE BY USERNAME
================================= */

const newChatForm = $("new-chat-form");
const usernameInput = $("new-chat-username");
const newChatResult = $("new-chat-result");

if (newChatForm && usernameInput && newChatResult) {
  newChatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const user = auth.currentUser;
    const username = usernameInput.value.trim();
    const usernameLower = username.toLowerCase();

    if (!user) {
      newChatResult.textContent =
        "Please log in before searching for people.";
      return;
    }

    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      newChatResult.textContent =
        "Enter a username with 3–20 letters, numbers, or underscores.";
      return;
    }

    newChatResult.textContent = "Searching...";

    try {
      // Find the exact username reservation document
      const usernameRef = doc(
        db,
        "usernames",
        usernameLower
      );

      const usernameSnapshot = await getDoc(usernameRef);

      if (!usernameSnapshot.exists()) {
        newChatResult.textContent =
          "No account found with that username.";
        return;
      }

      const usernameData = usernameSnapshot.data();
      const foundUid = usernameData.uid;

      if (!foundUid) {
        newChatResult.textContent =
          "This profile is unavailable.";
        return;
      }

      // Do not allow a user to search for themselves
      if (foundUid === user.uid) {
        newChatResult.textContent =
          "That's your own username! Try finding someone else.";
        return;
      }

      // Load the matching public profile
      const profileRef = doc(
        db,
        "users",
        foundUid
      );

      const profileSnapshot = await getDoc(profileRef);

      if (!profileSnapshot.exists()) {
        newChatResult.textContent =
          "This profile is currently unavailable.";
        return;
      }

      const profile = profileSnapshot.data();
      const displayName = profile.username || username;

      // Build the result safely using textContent
      newChatResult.replaceChildren();

      const resultCard = document.createElement("div");
      resultCard.className = "user-search-result";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent =
        displayName.charAt(0).toUpperCase();

      const info = document.createElement("div");
      info.className = "user-search-info";

      const name = document.createElement("strong");
      name.textContent = displayName;

      const handle = document.createElement("p");
      handle.textContent = "@" + usernameLower;

      const note = document.createElement("p");
      note.textContent =
        "Profile found. Connect only if they agree to chat.";

      info.append(name, handle, note);
      resultCard.append(avatar, info);
      newChatResult.appendChild(resultCard);

    } catch (error) {
      console.error("Username search failed:", error);

      if (error.code === "permission-denied") {
        newChatResult.textContent =
          "Search was blocked by Firestore rules. Check your username and profile read permissions.";
      } else {
        newChatResult.textContent =
          "Unable to search right now. Please try again.";
      }
    }
  }, true);
}

// LOGOUT
const logoutButton = $("logout-btn");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.replace("index.html");
    } catch (error) {
      console.error(error);
      alert("Unable to log out. Please try again.");
    }
  });
}