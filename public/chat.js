document.addEventListener("DOMContentLoaded", () => {
  const messageForm = document.querySelector(".message-form");
  const messageInput = document.getElementById("message-input");
  const messagesList = document.querySelector(".messages-list");
  const currentUserDisplay = document.getElementById("current-user");
  let currentUsername = localStorage.getItem("username");
  let currentUserId = localStorage.getItem("userId");

  currentUserDisplay.textContent = currentUsername;
  currentUserDisplay.style.fontWeight = "bold";

  const suggestionsPanel = document.createElement("div");
  suggestionsPanel.id = "suggestions";
  messageForm.appendChild(suggestionsPanel);

  let users = [];
  function fetchUsers() {
    fetch("/api/users", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((fetchedUsers) => {
        users = fetchedUsers.filter((user) => user.username !== currentUsername);

        messageInput.disabled = false;
      })
      .catch((error) => console.error("Error fetching users:", error));
  }

  messageInput.disabled = true;

  fetchUsers();

  function appendMessage(message) {
    let messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.dataset.username = message.owner.username;
    messageElement.dataset.messageId = message._id;

    if (message.owner.username === currentUsername) {
      messageElement.classList.add("message-user");
    }

    let usernameElement = document.createElement("div");
    usernameElement.textContent = message.owner.username;
    usernameElement.style.fontWeight = "bold";
    usernameElement.classList.add("message-username");

    let textElement = document.createElement("div");
    textElement.classList.add("message-text");

    if (message.isDeleted) {
      textElement.textContent = "Bu mesaj permanently silindi.";
      textElement.style.color = "gray";
    } else if (message.deletedFrom.includes(currentUserId)) {
      textElement.textContent = "Bu mesajı sildiniz.";
      textElement.style.color = "gray";
    } else {
      textElement.innerHTML = linkifyMessage(message.text);
      messageElement.ondblclick = function (event) {
        showContextMenu(event, messageElement, message.owner.username === currentUsername);
      };
    }

    messageElement.appendChild(usernameElement);
    messageElement.appendChild(textElement);
    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  function linkifyMessage(text) {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
    text = text.replace(urlRegex, function (url) {
      return `<a href="${url}" target="_blank" class="message-link">${url}</a>`;
    });

    const mentionRegex = /@(\w+)/g;
    text = text.replace(mentionRegex, function (match, username) {
      if (users.some((user) => user.username === username)) {
        return `<span class="mention">${match}</span>`;
      }
      return match;
    });

    return text;
  }

  function showContextMenu(event, messageElement, isOwnedByUser) {
    event.preventDefault();
    const contextMenu = document.getElementById("context-menu");
    const menuList = contextMenu.querySelector(".context-menu-list");
    menuList.innerHTML = "";

    let options = isOwnedByUser
      ? ["Delete for Me", "Delete for Everyone", "Copy", "Forward", "Edit Message"]
      : ["Delete for Me", "Copy", "Forward"];
    options.forEach((option) => {
      let li = document.createElement("li");
      li.textContent = option;
      li.onclick = () => handleMenuOption(option, messageElement);
      menuList.appendChild(li);
    });

    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.display = "block";

    document.onclick = function () {
      contextMenu.style.display = "none";
    };
  }

  function handleMenuOption(option, messageElement) {
    const messageId = messageElement.dataset.messageId;
    switch (option) {
      case "Delete for Me":
        removeFromCurrentUser(messageId);
        break;
      case "Delete for Everyone":
        deleteForEveryone(messageId);
        break;
      case "Copy":
        copyToClipboard(messageElement.querySelector(".message-text").textContent);
        break;
      case "Forward":
        forwardMessage(messageElement.querySelector(".message-text").textContent);
        break;
      case "Edit Message":
        editMessage(messageElement);
        break;
    }
  }

  function removeFromCurrentUser(messageId) {
    console.log("Removing message for user ID:", currentUserId, "for message ID:", messageId);

    fetch(`/api/messages/deleteFromCurrentUser/${messageId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message) {
          console.error("Error removing message:", data.message);
        } else {
          console.log("Successfully removed from current user view:", data);
        }
      })
      .catch((err) => console.error("Fetch error:", err));
  }

  function deleteForEveryone(messageId) {
    fetch(`/api/messages/deleteForEveryone/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    }).then((response) => {
      if (response.ok) {
        console.log("Deleted for everyone");
      }
    });
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(
      () => {
        console.log("Text copied to clipboard");
      },
      (err) => {
        console.error("Failed to copy text: ", err);
      }
    );
  }

  function forwardMessage(text) {
    const messageData = { text: text, owner: currentUsername };
    fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to send message");
        return response.json();
      })
      .then((message) => {
        ws.send(JSON.stringify(message));
        messageInput.value = "";
      })
      .catch((error) => console.error("Error:", error));
  }

  function editMessage(messageElement) {
    let currentMessageInput = document.getElementById("message-input");
    let confirmButton = document.getElementById("edit-confirm-button");
    let sendButton = document.getElementById("submit-button");

    currentMessageInput.value = messageElement.querySelector(".message-text").textContent;
    currentMessageInput.focus();

    confirmButton.style.display = "block";
    sendButton.style.display = "none";

    confirmButton.onclick = function () {
      fetch(`/api/messages/edit/${messageElement.dataset.messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentMessageInput.value }),
      }).then((response) => {
        if (response.ok) {
          console.log("Updated the message");
          currentMessageInput.value = "";
          confirmButton.style.display = "none";
          sendButton.style.display = "block";
        } else {
          console.error("Failed to update the message");
        }
      });
    };
  }

  function fetchMessages() {
    fetch("/api/messages")
      .then((response) => response.json())
      .then((messages) => {
        messages.forEach(appendMessage);
        messagesList.scrollTop = messagesList.scrollHeight;
      })
      .catch((error) => console.error("Error fetching messages:", error));
  }

  let ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = function () {
    console.log("Connected to the WebSocket");
    fetchMessages();
    fetchUsers();
  };

  ws.onmessage = function (event) {
    console.log("event is", event);
    const data = JSON.parse(event.data);
    console.log("Received message:", data);
    if (data.type === "new") {
      appendMessage(data.message);
    } else if (data.type === "deleteone") {
      removeMessageOneDOM(data.message);
    } else if (data.type === "deleteall") {
      removeMessageAllDOM(data.id);
    } else if (data.type === "update") {
      updateMessageDOM(data);
    }
  };

  function updateMessageDOM(data) {
    console.log("updated data is", data);
    let messageElement = document.querySelector(`[data-message-id="${data.message._id}"] .message-text`);
    if (messageElement) {
      messageElement.innerHTML = linkifyMessage(data.message.text);
    }
  }

  function removeMessageOneDOM(message) {
    console.log("message id is", message._id);
    let messageElement = document.querySelector(`[data-message-id="${message._id}"]`);
    if (messageElement && message.deletedFrom.includes(currentUserId)) {
      messageText = messageElement.querySelector(".message-text");
      messageText.textContent = "Bu mesajı sildiniz.";
      messageText.style.color = "gray";
    }
  }

  function removeMessageAllDOM(messageId) {
    let messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      console.log("message element is", messageElement);
      messageText = messageElement.querySelector(".message-text");
      messageText.textContent = "Bu mesaj permanently silindi.";
      messageText.style.color = "gray";
    }
  }

  ws.onclose = function () {
    console.log("Disconnected from WebSocket");
  };

  messageInput.addEventListener("input", function () {
    const value = messageInput.value;
    suggestionsPanel.innerHTML = "";
    if (value.includes("@")) {
      const lastAtPos = value.lastIndexOf("@");
      const typedName = value.substring(lastAtPos + 1);
      const suggestions = users.filter((user) => user.username.startsWith(typedName));
      if (suggestions.length > 0) {
        suggestionsPanel.style.display = "block";
        suggestions.forEach((user) => {
          const div = document.createElement("div");
          div.textContent = user.username;
          div.className = "suggestion";
          div.onclick = function () {
            messageInput.value = `${value.substring(0, lastAtPos)}@${user.username} `;
            suggestionsPanel.innerHTML = "";
            messageInput.focus();
            suggestionsPanel.style.display = "none";
          };
          suggestionsPanel.appendChild(div);
        });
      } else {
        suggestionsPanel.style.display = "none";
      }
    } else {
      suggestionsPanel.style.display = "none";
    }
  });

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    let currentMessageInput = document.getElementById("message-input");
    let confirmButton = document.getElementById("edit-confirm-button");
    let sendButton = document.getElementById("submit-button");

    if (confirmButton.style.display === "block") {
      return;
    }

    const messageText = currentMessageInput.value.trim();
    if (messageText) {
      const messageData = { text: messageText, owner: currentUsername };
      fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Failed to send message");
          return response.json();
        })
        .then((message) => {
          ws.send(JSON.stringify(message));
          currentMessageInput.value = "";
        })
        .catch((error) => console.error("Error:", error));
    }
  });
});
