// Hardcoded users for demonstration; consider using env variables for real deployments
const USERS = { 
  "Jonathan": "JonathanAndJames", 
  "James": "JamesPassword2025", 
  "Wen": "WenPassword2025" 
};

const server = Bun.serve({
  port: 3001,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const auth = req.headers.get("Authorization");

    // 1. Improved Basic Auth logic
    let isAuthorized = false;
    if (auth?.startsWith("Basic ")) {
      try {
        const credentials = Buffer.from(auth.split(" ")[1], "base64").toString();
        const [user, pass] = credentials.split(":");
        if (USERS[user] && USERS[user] === pass) isAuthorized = true;
      } catch (e) {
        console.error("Auth Decode Error:", e);
      }
    }

    if (!isAuthorized) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="AI Terminal"' },
      });
    }

    // 2. Terminal UI Route
    if (req.method === "GET" && url.pathname === "/") {
      return new Response(`
        <html>
        <head>
          <title>Jellyfish AI OS</title>
          <style>
            body { background: #000; color: #0f0; font-family: monospace; padding: 20px; margin: 0; }
            #term { height: 85vh; overflow-y: auto; border: 1px solid #333; padding: 15px; background: #050505; }
            .prompt { color: #55f; font-weight: bold; }
            .input-area { margin-top: 15px; display: flex; align-items: center; }
            input { background: transparent; border: none; color: #0f0; outline: none; flex-grow: 1; font-family: monospace; font-size: 1.1rem; }
            .ai-response { color: white; margin: 10px 0 20px 20px; white-space: pre-wrap; border-left: 2px solid #333; padding-left: 10px; }
          </style>
        </head>
        <body>
          <div id="term"><p style="color:#888;">Jellyfish AI OS [Build Dec-2025]</p></div>
          <div class="input-area">
            <span class="prompt">jonathan@Jellyfish:~$</span>&nbsp;
            <input id="cmd" autofocus autocomplete="off">
          </div>
          <script>
            const input = document.getElementById('cmd');
            const term = document.getElementById('term');

            input.addEventListener('keypress', async (e) => {
              if (e.key === 'Enter') {
                const val = input.value.trim();
                if (!val) return;
                input.value = '';

                // Log user command
                const userLine = document.createElement('p');
                userLine.innerHTML = '<span class="prompt">jonathan@Jellyfish:~$</span> ' + val;
                term.appendChild(userLine);
                term.scrollTop = term.scrollHeight;

                try {
                  const res = await fetch('/ask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: val })
                  });
                  
                  const text = await res.text();
                  const aiLine = document.createElement('div');
                  aiLine.className = 'ai-response';
                  aiLine.textContent = 'llama@ai: ' + text;
                  term.appendChild(aiLine);
                } catch (err) {
                  const errLine = document.createElement('p');
                  errLine.style.color = 'red';
                  errLine.textContent = 'Error: Bridge Failure. Ollama may be offline.';
                  term.appendChild(errLine);
                }
                term.scrollTop = term.scrollHeight;
              }
            });
          </script>
        </body>
        </html>
      `, { headers: { "Content-Type": "text/html" } });
    }

    // 3. AI LOGIC (Ollama Integration)
    if (req.method === "POST" && url.pathname === "/ask") {
      try {
        const { prompt } = await req.json();
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            model: "llama3.2:1b", 
            prompt: prompt, 
            stream: false 
          })
        });

        if (!response.ok) throw new Error("Ollama connection failed");
        
        const data = await response.json();
        return new Response(data.response || "No response generated."); // Extracting 'response' field
      } catch (err) {
        return new Response("Ollama is offline or model not found.", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log("🚀 AI Terminal active at http://localhost:3001");
