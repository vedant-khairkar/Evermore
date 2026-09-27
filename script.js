/* =========================================================
   EVERMORE — MAIN UI SCRIPT
   Authentication: firebase.js
   UI: Chats, Groups, Profile, Theme, Recent Conversations

   NOTE:
   Chat and group data is currently stored locally.
   Firestore synchronization will be added separately.
========================================================= */

"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = "evermore-demo-state";
  const THEME_KEY = "evermore-theme";

  const state = {
    user: null,
    conversations: [],
    activeChat: null,
    groups: []
  };

  // =======================================================
  // STORAGE
  // =======================================================

  function readStorage(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Could not read saved data:", error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Could not save data:", error);
    }
  }

  function loadDemoState() {
    const saved = readStorage(STORAGE_KEY, {});

    state.user = saved.user || null;

    state.conversations =
      Array.isArray(saved.conversations)
        ? saved.conversations
        : [];

    state.groups =
      Array.isArray(saved.groups)
        ? saved.groups
        : [];

    state.activeChat = saved.activeChat || null;
  }

  function saveDemoState() {
    writeStorage(STORAGE_KEY, {
      user: state.user,
      conversations: state.conversations,
      activeChat: state.activeChat,
      groups: state.groups
    });
  }

  // =======================================================
  // COMMON HELPERS
  // =======================================================

  function goTo(page) {
    window.location.href = page;
  }

  function makeId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2)
    );
  }

  function initials(name = "") {
    const words = String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return words
      .slice(0, 2)
      .map(word => word[0])
      .join("")
      .toUpperCase() || "U";
  }

  function currentUsername() {
    return (
      state.user ||
      localStorage.getItem("evermore-username") ||
      "User"
    );
  }

  function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function showMessage(element, message, isError = false) {
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", isError);
    element.setAttribute("role", "status");
  }

  // =======================================================
  // THEME
  // =======================================================

  function setTheme(theme) {
    const selectedTheme =
      theme === "light" ? "light" : "dark";

    document.documentElement.dataset.theme =
      selectedTheme;

    document.body.classList.toggle(
      "light-mode",
      selectedTheme === "light"
    );

    const toggle = $("theme-toggle");

    if (toggle) {
      if (toggle.type === "checkbox") {
        toggle.checked = selectedTheme === "dark";
      } else {
        toggle.textContent =
          selectedTheme === "dark" ? "☾" : "☀";
      }
    }

    try {
      localStorage.setItem(
        THEME_KEY,
        selectedTheme
      );
    } catch (_) {}
  }

  function initTheme() {
    let theme = "dark";

    try {
      theme =
        localStorage.getItem(THEME_KEY) || "dark";
    } catch (_) {}

    setTheme(theme);

    const toggle = $("theme-toggle");

    if (!toggle) return;

    if (toggle.type === "checkbox") {
      toggle.addEventListener("change", () => {
        setTheme(
          toggle.checked ? "dark" : "light"
        );
      });
    } else {
      toggle.addEventListener("click", () => {
        const next =
          document.body.classList.contains("light-mode")
            ? "dark"
            : "light";

        setTheme(next);
      });
    }
  }

  // =======================================================
  // PROFILE DISPLAY
  // =======================================================

  function renderAccountDetails() {
    const username = currentUsername();
    const avatarText = initials(username);

    if ($("home-avatar")) {
      $("home-avatar").textContent = avatarText;
    }

    if ($("profile-name")) {
      $("profile-name").textContent = username;
    }

    if ($("profile-avatar")) {
      $("profile-avatar").textContent = avatarText;
    }
  }

  // =======================================================
  // CONVERSATION HELPERS
  // =======================================================

  function getConversation(id) {
    return state.conversations.find(
      chat => chat.id === id
    ) || null;
  }

  function createConversation(
    name,
    type = "private",
    members = []
  ) {
    const cleanName = String(name || "").trim();

    if (!cleanName) return null;

    const conversation = {
      id: makeId(),
      name: cleanName,
      type,
      members: [
        ...new Set([
          currentUsername(),
          ...members
        ].filter(Boolean))
      ],
      messages: [],
      lastMessage: "",
      updatedAt: Date.now()
    };

    state.conversations.unshift(conversation);

    saveDemoState();

    return conversation;
  }

  // =======================================================
  // CHAT CONTACT LIST
  // =======================================================

  function renderContacts() {
    const contactList = $("contact-list");

    if (!contactList) return;

    const query =
      ($("contact-search")?.value || "")
        .trim()
        .toLowerCase();

    const filtered =
      state.conversations.filter(chat =>
        chat.name.toLowerCase().includes(query)
      );

    contactList.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";

      const paragraph =
        document.createElement("p");

      paragraph.textContent = query
        ? "No conversations match your search."
        : "No conversations yet. Start a chat with someone who has agreed to connect.";

      empty.appendChild(paragraph);
      contactList.appendChild(empty);

      return;
    }

    filtered.forEach(chat => {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "contact-item";

      button.classList.toggle(
        "active",
        chat.id === state.activeChat
      );

      button.setAttribute(
        "aria-label",
        `Open conversation with ${chat.name}`
      );

      const avatar =
        document.createElement("div");

      avatar.className = "avatar";

      avatar.textContent =
        chat.type === "group"
          ? "👥"
          : initials(chat.name);

      const details =
        document.createElement("div");

      details.className = "contact-details";

      const title =
        document.createElement("h4");

      title.textContent = chat.name;

      const preview =
        document.createElement("p");

      preview.textContent =
        chat.lastMessage || "No messages yet";

      details.append(title, preview);

      button.append(avatar, details);

      button.addEventListener("click", () => {
        openChat(chat.id);
      });

      contactList.appendChild(button);
    });
  }

  // =======================================================
  // OPEN CHAT
  // =======================================================

  function openChat(id) {
    const chat = getConversation(id);

    if (!chat) return;

    state.activeChat = id;

    saveDemoState();

    if ($("chat-name")) {
      $("chat-name").textContent = chat.name;
    }

    if ($("chat-avatar")) {
      $("chat-avatar").textContent =
        chat.type === "group"
          ? "👥"
          : initials(chat.name);
    }

    if ($("chat-status")) {
      $("chat-status").textContent =
        chat.type === "group"
          ? `${chat.members.length} members · Local demo`
          : "Local demo conversation";
    }

    if ($("message-input")) {
      $("message-input").disabled = false;
      $("message-input").focus();
    }

    if ($("send-btn")) {
      $("send-btn").disabled = false;
    }

    renderMessages();
    renderContacts();
  }

  // =======================================================
  // RENDER MESSAGES
  // =======================================================

  function renderMessages() {
    const container = $("messages");

    if (!container) return;

    container.replaceChildren();

    const chat =
      getConversation(state.activeChat);

    if (!chat) {
      const welcome =
        document.createElement("div");

      welcome.className = "welcome-message";

      const heading =
        document.createElement("h2");

      heading.textContent =
        "Your conversations start here.";

      const paragraph =
        document.createElement("p");

      paragraph.textContent =
        "Choose a conversation or start a new one.";

      welcome.append(heading, paragraph);

      container.appendChild(welcome);

      return;
    }

    if (!chat.messages.length) {
      const welcome =
        document.createElement("div");

      welcome.className = "welcome-message";

      const heading =
        document.createElement("h2");

      heading.textContent = "Say hello!";

      const paragraph =
        document.createElement("p");

      paragraph.textContent =
        "This is the beginning of your local demo conversation.";

      welcome.append(heading, paragraph);

      container.appendChild(welcome);

      return;
    }

    chat.messages.forEach(message => {
      const wrapper =
        document.createElement("div");

      const sent =
        message.sender === currentUsername();

      wrapper.className =
        `message ${sent ? "sent" : "received"}`;

      const text =
        document.createElement("p");

      text.textContent = message.text;

      const time =
        document.createElement("span");

      time.className = "message-time";
      time.textContent = message.time || "";

      wrapper.append(text, time);

      container.appendChild(wrapper);
    });

    container.scrollTop =
      container.scrollHeight;
  }

  // =======================================================
  // CHAT PAGE INITIALIZATION
  // =======================================================

  function initChatPage() {
    if (
      !$("contact-list") &&
      !$("message-form")
    ) {
      return;
    }

    renderContacts();

    $("contact-search")?.addEventListener(
      "input",
      renderContacts
    );

    // New chat dialog
    $("new-chat-btn")?.addEventListener(
      "click",
      () => {
        $("new-chat-dialog")?.showModal();
        $("new-chat-username")?.focus();
      }
    );

    $("cancel-chat")?.addEventListener(
      "click",
      () => {
        $("new-chat-dialog")?.close();
      }
    );

    // Create local demo conversation
    $("new-chat-form")?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const username =
          $("new-chat-username")?.value.trim() || "";

        if (
          !/^[A-Za-z0-9_]{3,20}$/.test(username)
        ) {
          alert(
            "Enter a username using 3–20 letters, numbers, or underscores."
          );
          return;
        }

        if (
          username.toLowerCase() ===
          currentUsername().toLowerCase()
        ) {
          alert(
            "You cannot start a conversation with your own account."
          );
          return;
        }

        const existing =
          state.conversations.find(chat =>
            chat.type === "private" &&
            chat.name.toLowerCase() ===
              username.toLowerCase()
          );

        const chat =
          existing ||
          createConversation(
            username,
            "private",
            [username]
          );

        if (!chat) return;

        $("new-chat-dialog")?.close();
        $("new-chat-form")?.reset();

        renderContacts();
        openChat(chat.id);
      }
    );

    // Send local demo message
    $("message-form")?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const input = $("message-input");

        const text =
          input?.value.trim() || "";

        const chat =
          getConversation(state.activeChat);

        if (!chat || !text) return;

        chat.messages.push({
          id: makeId(),
          sender: currentUsername(),
          text,
          time: formatTime()
        });

        chat.lastMessage = text;
        chat.updatedAt = Date.now();

        if (input) input.value = "";

        saveDemoState();

        renderMessages();
        renderContacts();
      }
    );

    // Emoji button
    $("emoji-btn")?.addEventListener(
      "click",
      () => {
        const input = $("message-input");

        if (!input || input.disabled) return;

        input.value += " 🙂";
        input.focus();
      }
    );

    // Restore selected local conversation
    if (
      state.activeChat &&
      getConversation(state.activeChat)
    ) {
      openChat(state.activeChat);
    } else {
      renderMessages();
    }
  }

  // =======================================================
  // GROUPS
  // =======================================================

  function renderGroups() {
    const list = $("group-list");

    if (!list) return;

    list.replaceChildren();

    const groups = state.groups;

    if ($("group-count")) {
      $("group-count").textContent =
        `${groups.length} ${
          groups.length === 1 ? "group" : "groups"
        }`;
    }

    if (!groups.length) {
      const empty =
        document.createElement("div");

      empty.className = "empty-state";

      const heading =
        document.createElement("h3");

      heading.textContent = "No groups yet";

      const paragraph =
        document.createElement("p");

      paragraph.textContent =
        "Create a group with people who have agreed to participate.";

      empty.append(heading, paragraph);
      list.appendChild(empty);

      return;
    }

    groups.forEach(group => {
      const card =
        document.createElement("article");

      card.className = "dashboard-card";

      const icon =
        document.createElement("div");

      icon.className = "card-icon";
      icon.textContent = "👥";

      const heading =
        document.createElement("h3");

      heading.textContent = group.name;

      const members =
        document.createElement("p");

      members.textContent =
        `${group.members.length} members`;

      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "secondary-btn";
      button.textContent = "Open Group";

      button.addEventListener("click", () => {
        let chat =
          state.conversations.find(
            item => item.id === group.id
          );

        if (!chat) {
          chat = {
            id: group.id,
            name: group.name,
            type: "group",
            members: group.members,
            messages: [],
            lastMessage: "",
            updatedAt: Date.now()
          };

          state.conversations.unshift(chat);

          saveDemoState();
        }

        state.activeChat = chat.id;

        saveDemoState();

        goTo("chats.html");
      });

      card.append(
        icon,
        heading,
        members,
        button
      );

      list.appendChild(card);
    });
  }

  function initGroupsPage() {
    if (!$("group-list")) return;

    renderGroups();

    $("new-group-btn")?.addEventListener(
      "click",
      () => {
        $("new-group-dialog")?.showModal();
        $("group-name")?.focus();
      }
    );

    $("cancel-group")?.addEventListener(
      "click",
      () => {
        $("new-group-dialog")?.close();
      }
    );

    $("new-group-form")?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const name =
          $("group-name")?.value.trim() || "";

        const rawMembers =
          $("group-members")?.value || "";

        const members = rawMembers
          .split(",")
          .map(item => item.trim())
          .filter(item =>
            /^[A-Za-z0-9_]{3,20}$/.test(item)
          );

        if (!name) {
          alert("Enter a group name.");
          return;
        }

        const group = {
          id: makeId(),
          name,
          members: [
            ...new Set([
              currentUsername(),
              ...members
            ])
          ],
          createdAt: Date.now()
        };

        state.groups.unshift(group);

        state.conversations.unshift({
          id: group.id,
          name: group.name,
          type: "group",
          members: group.members,
          messages: [],
          lastMessage: "",
          updatedAt: Date.now()
        });

        saveDemoState();

        renderGroups();

        $("new-group-dialog")?.close();
        $("new-group-form")?.reset();
      }
    );
  }

  // =======================================================
  // HOME — RECENT CONVERSATIONS
  // =======================================================

  function renderRecentConversations() {
    const container =
      $("recent-conversations");

    if (!container) return;

    container.replaceChildren();

    const recent =
      [...state.conversations]
        .sort(
          (a, b) =>
            (b.updatedAt || 0) -
            (a.updatedAt || 0)
        )
        .slice(0, 5);

    if (!recent.length) {
      const empty =
        document.createElement("div");

      empty.className = "empty-state";

      const heading =
        document.createElement("h3");

      heading.textContent =
        "Your conversations start here.";

      const paragraph =
        document.createElement("p");

      paragraph.textContent =
        "Open Chats to begin a conversation with someone who has agreed to connect.";

      empty.append(heading, paragraph);

      container.appendChild(empty);

      return;
    }

    recent.forEach(chat => {
      const card =
        document.createElement("a");

      card.className =
        "dashboard-card recent-card";

      card.href = "chats.html";

      const heading =
        document.createElement("h3");

      heading.textContent = chat.name;

      const preview =
        document.createElement("p");

      preview.textContent =
        chat.lastMessage || "No messages yet";

      card.append(heading, preview);

      card.addEventListener("click", () => {
        state.activeChat = chat.id;
        saveDemoState();
      });

      container.appendChild(card);
    });
  }

  // =======================================================
  // INITIALIZATION
  // =======================================================

  function init() {
    loadDemoState();

    initTheme();

    renderAccountDetails();

    renderRecentConversations();

    initChatPage();

    initGroupsPage();

    console.log(
      "Evermore UI initialized. Chats and groups are local demo data."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();