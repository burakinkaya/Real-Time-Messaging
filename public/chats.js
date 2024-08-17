document.addEventListener("DOMContentLoaded", () => {
  const currentUsername = localStorage.getItem("username");

  if (!currentUsername) {
    window.location.href = "/";
    return;
  }
  const currentUserId = localStorage.getItem("userId");
  const chatList = document.getElementById("chat-list");
  const newChatBtn = document.getElementById("new-chat-btn");
  const messagesContainer = document.getElementById("messages-container");
  const messagesList = messagesContainer.querySelector(".messages-list");
  const messageForm = messagesContainer.querySelector(".message-form");
  const messageInput = document.getElementById("message-input");
  const chatUsernameDisplay = document.getElementById("chat-username");
  const userListModal = document.getElementById("userListModal");
  const closeUserListModal = document.getElementById("closeUserListModal");
  const userList = document.getElementById("userList");

  const prime = BigInt("104729");

  let sharedSecrets = {};
  let users = [];

  let ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = function () {
    ws.send(JSON.stringify({ type: "auth", userId: currentUserId }));

    fetchUsers().then(() => {
      fetchChats();
    });
  };

  ws.onmessage = function (event) {
    const data = JSON.parse(event.data);
    console.log("Received message:", data);

    const sharedSecret =
      sharedSecrets[data.message.owner._id === currentUserId ? data.message.receiver._id : data.message.owner._id];
    const otherUser = data.message.owner._id === currentUserId ? data.message.receiver : data.message.owner;
    const existingChatItem = document.querySelector(`.chat-item[data-user-id="${otherUser._id}"]`);

    // console.log("Shared secret for decryption:", sharedSecret);
    // console.log("Other user involved:", otherUser);
    // console.log("Existing chat item found:", existingChatItem);

    if (!sharedSecret) {
      console.error("Shared secret not found for decryption");
      return;
    }

    let decryptedText;

    if (data.type === "new") {
      decryptedText = decryptMessage(sharedSecret, data.message.text);
      // console.log("Decrypted new message text:", decryptedText);

      const isCurrentUserInvolved =
        data.message.owner._id === currentUserId || data.message.receiver._id === currentUserId;
      // console.log("Is current user involved in the message:", isCurrentUserInvolved);

      if (isCurrentUserInvolved) {
        const messagesWithData = {
          data: {
            ...data.message,
            text: decryptedText,
          },
        };
        appendMessage(messagesWithData, currentUserId);

        if (existingChatItem) {
          existingChatItem.setAttribute("data-last-message-id", data.message._id);
          existingChatItem.querySelector(".chat-last-message").textContent = decryptedText;
          chatList.prepend(existingChatItem);
        } else {
          const newChatElement = document.createElement("div");
          newChatElement.className = "chat-item";
          newChatElement.setAttribute("data-user-id", otherUser._id);
          newChatElement.setAttribute("data-last-message-id", data.message._id);
          newChatElement.innerHTML = `
                    <div class="chat-user-name">${otherUser.username}</div>
                    <div class="chat-last-message">${decryptedText}</div>
                `;
          newChatElement.addEventListener("click", () => {
            startPrivateChat(otherUser._id, otherUser.username);
          });
          chatList.prepend(newChatElement);
        }
      }
    } else if (data.type === "deleteone") {
      if (data.message.deletedFrom.includes(currentUserId)) {
        decryptedText = "You deleted the message";
        console.log("Message deleted by current user:", decryptedText);
      } else {
        decryptedText = decryptMessage(sharedSecret, data.message.text);
        // console.log("Decrypted message text after deleteone:", decryptedText);
      }
      removeMessageOneDOM(data.message);
    } else if (data.type === "deleteall") {
      decryptedText = "This message is deleted";
      // console.log("Message deleted for all users:", decryptedText);
      removeMessageAllDOM(data.message._id);
    } else if (data.type === "update") {
      updateMessageDOM(data);
      decryptedText = decryptMessage(sharedSecret, data.message.text);
      // console.log("Decrypted message text after update:", decryptedText);
    }

    if (existingChatItem) {
      const lastMessageId = existingChatItem.getAttribute("data-last-message-id");
      // console.log("Last message ID stored in the chat item:", lastMessageId);
      // console.log("Current message ID being processed:", data.message._id);

      if (lastMessageId === data.message._id) {
        // console.log("Message IDs match, updating last message text.");
        existingChatItem.querySelector(".chat-last-message").textContent = decryptedText;
        chatList.prepend(existingChatItem);
      }
    }
  };

  function updateMessageDOM(data) {
    // console.log("updated data is", data);

    let messageElement = document.querySelector(`[data-message-id="${data.message._id}"] .message-text`);
    if (messageElement) {
      const isOwner = data.message.owner._id === currentUserId;
      // console.log("is owner", isOwner);
      const otherUserId = isOwner ? data.message.receiver._id : data.message.owner._id;
      // console.log("other user id", otherUserId);
      // console.log("all shared secrets are ", sharedSecrets);
      const sharedSecret = sharedSecrets[otherUserId];
      // console.log("shared secret is", sharedSecret);
      if (!sharedSecret) {
        console.error("Shared secret not found for decryption");
        return;
      }

      let decryptedText = data.message.text;
      if (data.message.text.includes(":")) {
        decryptedText = decryptMessage(sharedSecret, data.message.text);
      }

      messageElement.innerHTML = linkifyMessage(decryptedText);
    }
  }

  function removeMessageOneDOM(message) {
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
      messageText = messageElement.querySelector(".message-text");
      messageText.textContent = "Bu mesaj permanently silindi.";
      messageText.style.color = "gray";
    }
  }

  ws.onclose = function () {
    console.log("Disconnected from WebSocket");
  };

  function fetchChats() {
    fetch(`/api/messages/chats?userId=${currentUserId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.data) {
          chatList.innerHTML = "";
          data.data.forEach((chat) => {
            const otherUser = chat.lastMessage.owner === currentUserId ? chat.receiverDetails[0] : chat.ownerDetails[0];
            const sharedSecret = sharedSecrets[otherUser._id];

            if (!sharedSecret) {
              console.error(`Shared secret not found for user: ${otherUser.username}`);
              return;
            }

            let decryptedText;
            if (chat.lastMessage.isDeleted) {
              decryptedText = "This message is deleted";
            } else if (chat.lastMessage.deletedFrom.includes(currentUserId)) {
              decryptedText = "You deleted this message";
            } else {
              decryptedText = decryptMessage(sharedSecret, chat.lastMessage.text);
            }

            const chatElement = document.createElement("div");
            chatElement.className = "chat-item";
            chatElement.setAttribute("data-user-id", otherUser._id);
            chatElement.setAttribute("data-last-message-id", chat.lastMessage._id);
            chatElement.innerHTML = `
              <div class="chat-user-name">${otherUser.username}</div>
              <div class="chat-last-message">${decryptedText}</div>
            `;
            chatElement.addEventListener("click", () => {
              startPrivateChat(otherUser._id, otherUser.username);
            });
            chatList.appendChild(chatElement);
          });
        }
      })
      .catch((error) => console.error("Error fetching chats:", error));
  }

  function fetchUsers() {
    return new Promise((resolve, reject) => {
      fetch("/api/users", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.data) {
            userList.innerHTML = "";

            data.data.forEach((user) => {
              if (user.username !== currentUsername) {
                sharedSecrets[user._id] = computeSharedSecret(
                  localStorage.getItem("dhPrivateKey"),
                  user.dhPublicKey,
                  prime
                );

                const userElement = document.createElement("li");
                userElement.className = "chat-user";
                userElement.innerHTML = `
                              <div class="user-avatar"></div>
                              <div class="user-info">
                                  <div class="user-name">${user.username}</div>
                              </div>
                          `;
                userElement.addEventListener("click", () => {
                  startPrivateChat(user._id, user.username);
                  userListModal.style.display = "none";
                });
                userList.appendChild(userElement);
              }
            });
          }
          resolve();
        })
        .catch((error) => {
          console.error("Error fetching users:", error);
          reject(error);
        });
    });
  }

  newChatBtn.addEventListener("click", () => {
    fetchUsers();
    userListModal.style.display = "block";
  });

  closeUserListModal.addEventListener("click", () => {
    userListModal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target == userListModal) {
      userListModal.style.display = "none";
    }
  });

  function startPrivateChat(userId, username) {
    if (!sharedSecrets[userId]) {
      const otherUser = users.find((user) => user._id === userId);
      sharedSecrets[userId] = computeSharedSecret(localStorage.getItem("dhPrivateKey"), otherUser.dhPublicKey, prime);
    }
    const sharedSecret = sharedSecrets[userId];
    chatUsernameDisplay.textContent = username;
    messagesContainer.style.display = "flex";
    messagesList.innerHTML = "";
    fetchMessages(currentUserId, userId);

    messageForm.onsubmit = (e) => {
      e.preventDefault();
      const messageText = messageInput.value.trim();
      if (messageText) {
        sendMessage(currentUserId, userId, messageText);
        messageInput.value = "";
      }
    };
  }

  function sendMessage(userId, chatUserId, text) {
    fetch(`/api/users/${chatUserId}`)
      .then((response) => response.json())
      .then((receiverData) => {
        const sharedSecret = sharedSecrets[chatUserId];
        const encryptedText = encryptMessage(sharedSecret, text);
        const messageData = {
          text: encryptedText,
          owner: userId,
          receiver: chatUserId,
        };

        return fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messageData),
        });
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((message) => {
        if (message && message.data) {
          console.log("Message sent and encrypted:", message.data.text);
        } else {
          console.error("Error: message.data is undefined");
        }
      })
      .catch((error) => console.error("Error sending message:", error));
  }

  function appendMessage(message, userId) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.dataset.username = message.data.owner.username;
    messageElement.dataset.messageId = message.data._id;

    if (message.data.owner._id === userId) {
      messageElement.classList.add("message-user");
    }

    const usernameElement = document.createElement("div");
    usernameElement.textContent = message.data.owner.username;
    usernameElement.style.fontWeight = "bold";
    usernameElement.classList.add("message-username");

    const textElement = document.createElement("div");
    textElement.classList.add("message-text");

    if (message.data.isDeleted) {
      textElement.textContent = "Bu mesaj permanently silindi.";
      textElement.style.color = "gray";
    } else if (message.data.deletedFrom.includes(userId)) {
      textElement.textContent = "Bu mesajı sildiniz.";
      textElement.style.color = "gray";
    } else {
      textElement.innerHTML = linkifyMessage(message.data.text);
    }

    if (!message.data.isDeleted && !message.data.deletedFrom.includes(userId)) {
      messageElement.ondblclick = function (event) {
        showContextMenu(event, { ...message.data, text: textElement.textContent }, message.data.owner._id === userId);
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

  function showContextMenu(event, MessageData, isOwnedByUser) {
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
      li.onclick = () => handleMenuOption(option, MessageData);
      menuList.appendChild(li);
    });

    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.display = "block";

    document.onclick = function () {
      contextMenu.style.display = "none";
    };
  }

  function handleMenuOption(option, MessageData) {
    // console.log("Selected option:", option, "for message:", MessageData);
    switch (option) {
      case "Delete for Me":
        removeFromCurrentUser(MessageData._id);
        break;
      case "Delete for Everyone":
        deleteForEveryone(MessageData._id);
        break;
      case "Copy":
        copyToClipboard(MessageData.text);
        break;
      case "Forward":
        forwardMessage(MessageData);
        break;
      case "Edit Message":
        editMessage(MessageData);
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
          console.log("Successfully removed from current user:", data);
        } else {
          console.error("Error removing message");
        }
      })
      .catch((err) => console.error("Fetch error:", err));
  }

  function deleteForEveryone(messageId) {
    fetch(`/api/messages/deleteForEveryone/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => {
        if (response.ok) {
          console.log("Deleted for everyone");
        } else {
          response.json().then((data) => {
            console.error("Failed to delete for everyone:", data.message);
          });
        }
      })
      .catch((error) => {
        console.error("Error occurred while deleting for everyone:", error);
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

  function forwardMessage(MessageData) {
    console.log("Forwarding message", MessageData);

    const currentUsername = localStorage.getItem("username");
    const currentUserId = localStorage.getItem("userId");

    let ownerId, receiverId;

    if (MessageData.owner.username === currentUsername) {
      ownerId = currentUserId;
      receiverId = MessageData.receiver._id;
      otherPublicKey = MessageData.receiver.dhPublicKey;
    } else {
      ownerId = currentUserId;
      receiverId = MessageData.owner._id;
      otherPublicKey = MessageData.owner.dhPublicKey;
    }

    const sharedSecret = sharedSecrets[receiverId] || sharedSecrets[ownerId];
    if (!sharedSecret) {
      console.error("Shared secret not found for encryption");
      return;
    }

    const encryptedText = encryptMessage(sharedSecret, MessageData.text);

    const messageData = {
      text: encryptedText,
      owner: ownerId,
      receiver: receiverId,
    };

    fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
    })
      .then((response) => {
        // console.log("Response:", response);
        if (!response.ok) throw new Error("Failed to send message");
        return response.json();
      })
      .catch((error) => console.error("Error:", error));
  }

  function editMessage(MessageData) {
    let currentMessageInput = document.getElementById("message-input");
    let confirmButton = document.getElementById("edit-confirm-button");
    let sendButton = document.getElementById("submit-button");

    const isOwner = MessageData.owner._id === currentUserId;
    const otherUserId = isOwner ? MessageData.receiver._id : MessageData.owner._id;

    const sharedSecret = sharedSecrets[otherUserId];
    if (!sharedSecret) {
      console.error("Shared secret not found for encryption");
      return;
    }

    let decryptedText = MessageData.text;
    let originalIv = "";
    if (MessageData.text.includes(":")) {
      [originalIv, decryptedText] = MessageData.text.split(":");
      decryptedText = decryptMessage(sharedSecret, MessageData.text);
    }

    currentMessageInput.value = decryptedText;
    currentMessageInput.focus();

    confirmButton.style.display = "block";
    sendButton.style.display = "none";

    confirmButton.onclick = function () {
      const updatedText = currentMessageInput.value.trim();
      if (!updatedText) return;

      const encryptedText = encryptMessage(sharedSecret, updatedText, originalIv);

      fetch(`/api/messages/edit/${MessageData._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: encryptedText }),
      }).then((response) => {
        if (response.ok) {
          response.json().then((updatedMessageData) => {
            MessageData.text = updatedMessageData.data.text;

            currentMessageInput.value = "";
            confirmButton.style.display = "none";
            sendButton.style.display = "block";
          });
        } else {
          console.error("Failed to update the message");
        }
      });
    };
  }

  function fetchMessages(userId, chatUserId) {
    return fetch(`/api/messages/private/${userId}/${chatUserId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((messages) => {
        const sharedSecret = sharedSecrets[chatUserId];
        const decryptedMessages = messages.map((message) => {
          return {
            ...message,
            text: decryptMessage(sharedSecret, message.text),
          };
        });

        const messagesWithData = decryptedMessages.map((message) => ({
          data: message,
        }));

        messagesWithData.forEach((message) => {
          appendMessage(message, userId);
        });

        messagesList.scrollTop = messagesList.scrollHeight;
      })
      .catch((error) => console.error("Error fetching messages:", error));
  }

  function computeSharedSecret(privateKey, otherPublicKey, prime) {
    // console.log("Compute Shared Secret:");
    // console.log("Private Key (BigInt):", BigInt(privateKey).toString());
    // console.log("Other's Public Key (BigInt):", BigInt(otherPublicKey).toString());
    // console.log("Prime (BigInt):", BigInt(prime).toString());

    const sharedSecret = BigInt(otherPublicKey) ** BigInt(privateKey) % BigInt(prime);
    // console.log("Computed Shared Secret (BigInt):", sharedSecret.toString());

    return Number(sharedSecret);
  }

  function encryptMessage(sharedSecret, message, ivBase64 = null) {
    // console.log("\nEncrypt Message:");
    // console.log("Shared Secret:", sharedSecret);

    const key = new TextEncoder().encode(sharedSecret.toString().padStart(32, "0").slice(0, 32));
    // console.log("Encryption Key (Uint8Array):", key);

    let iv;
    if (ivBase64) {
      iv = new Uint8Array(
        atob(ivBase64)
          .split("")
          .map((char) => char.charCodeAt(0))
      );
      // console.log("Using Provided IV (Uint8Array):", iv);
    } else {
      iv = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        iv[i] = Math.floor(Math.random() * 256);
      }
      // console.log("Generated IV (Uint8Array):", iv);
    }

    const messageBuffer = new TextEncoder().encode(message);
    // console.log("Message Buffer (Uint8Array):", messageBuffer);

    const cipherText = new Uint8Array(messageBuffer.length);
    for (let i = 0; i < messageBuffer.length; i++) {
      cipherText[i] = messageBuffer[i] ^ key[i % key.length] ^ iv[i % iv.length];
      // console.log(
      //   `Encrypting byte '${messageBuffer[i]}' with key[${i % key.length}] (keyCode: ${key[i % key.length]}) and iv[${
      //     i % iv.length
      //   }] (ivCode: ${iv[i % iv.length]}) = '${cipherText[i]}'`
      // );
    }

    const encryptedMessage = ivBase64
      ? btoa(String.fromCharCode(...cipherText))
      : `${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...cipherText))}`;

    // console.log("Encrypted Message (Base64):", encryptedMessage);

    return encryptedMessage;
  }

  function decryptMessage(sharedSecret, encryptedMessage) {
    // console.log("\nDecrypt Message:");
    // console.log("Shared Secret:", sharedSecret);

    const key = new TextEncoder().encode(sharedSecret.toString().padStart(32, "0").slice(0, 32));
    // console.log("Decryption Key (Uint8Array):", key);

    const [ivBase64, cipherTextBase64] = encryptedMessage.split(":");

    if (!isValidBase64(ivBase64) || !isValidBase64(cipherTextBase64)) {
      console.error("Invalid Base64 string for IV or CipherText");
      return "Error: Invalid Base64 string";
    }

    const iv = new Uint8Array(
      atob(ivBase64)
        .split("")
        .map((char) => char.charCodeAt(0))
    );
    const cipherText = new Uint8Array(
      atob(cipherTextBase64)
        .split("")
        .map((char) => char.charCodeAt(0))
    );

    // console.log("Decoded IV (Uint8Array):", iv);
    // console.log("Decoded CipherText (Uint8Array):", cipherText);

    const messageBuffer = new Uint8Array(cipherText.length);
    for (let i = 0; i < cipherText.length; i++) {
      messageBuffer[i] = cipherText[i] ^ key[i % key.length] ^ iv[i % iv.length];
      // console.log(
      //   `Decrypting byte '${cipherText[i]}' with key[${i % key.length}] (keyCode: ${key[i % key.length]}) and iv[${
      //     i % iv.length
      //   }] (ivCode: ${iv[i % iv.length]}) = '${messageBuffer[i]}'`
      // );
    }

    const message = new TextDecoder().decode(messageBuffer);
    console.log("Final Decrypted Message:", message);
    return message;
  }

  function isValidBase64(str) {
    try {
      return btoa(atob(str)) === str;
    } catch (err) {
      return false;
    }
  }
});
