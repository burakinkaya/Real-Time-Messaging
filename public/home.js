document.addEventListener("DOMContentLoaded", () => {
  const joinForm = document.getElementById("join-form");
  const nameInput = document.getElementById("name-input");

  function generateRandomBigInt(max) {
    const random = Math.floor(Math.random() * Number(max));
    return BigInt(random);
  }

  function generateKeys(prime, generator) {
    const privateKey = generateRandomBigInt(2 ** 16);
    const publicKey = generator ** privateKey % prime;
    return { privateKey, publicKey: Number(publicKey) };
  }

  joinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userName = nameInput.value.trim();
    const prime = BigInt("104729");
    const generator = BigInt(2);

    if (userName) {
      let privateKey;
      let publicKey;

      if (localStorage.getItem("username") === userName && localStorage.getItem("dhPrivateKey")) {
        console.log("User exists and private key found in localStorage.");
        privateKey = BigInt(localStorage.getItem("dhPrivateKey"));
        publicKey = generator ** privateKey % prime;
      } else {
        const keys = generateKeys(prime, generator);
        privateKey = keys.privateKey;
        publicKey = keys.publicKey;
        console.log("Generated new Private Key:", privateKey.toString());
        console.log("Generated new Public Key:", publicKey);
      }

      fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: userName, publicKey: publicKey.toString() }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data._id) {
            localStorage.setItem("username", userName);
            localStorage.setItem("userId", data._id);
            localStorage.setItem("dhPrivateKey", privateKey.toString());

            setTimeout(() => {
              window.location.href = "/chats.html";
            }, 1500);
          } else {
            console.error("Invalid response data. Missing userId.");
          }
        })
        .catch((error) => console.error("Error:", error));
    }
  });
});
