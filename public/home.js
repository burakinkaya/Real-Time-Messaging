document.addEventListener("DOMContentLoaded", () => {
  const joinForm = document.getElementById("join-form");
  const nameInput = document.getElementById("name-input");

  joinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userName = nameInput.value.trim();
    if (userName) {
      fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: userName }),
      })
        .then((response) => response.json())
        .then((data) => {
          localStorage.setItem("username", userName);
          localStorage.setItem("userId", data._id);
          window.location.href = "/chat.html";
        })
        .catch((error) => console.error("Error:", error));
    }
  });
});
