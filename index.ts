const USERS: Record<string, string> = { "Jonathan": "JonathanAndJames" };

const server = Bun.serve({
  port: 3001,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const auth = req.headers.get("Authorization");

    // 1. Proper Basic Auth validation
    if (!auth?.startsWith("Basic ")) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Jellyfish AI OS"' }
      });
    }

    try {
      const decoded = atob(auth.slice(6));
      const [username, password] = decoded.split(":");
      if (!username || !password || USERS[username] !== password) {
        return new Response("Invalid credentials", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Jellyfish AI OS"' }
        });
      }
    } catch {
      return new Response("Bad auth header", { status: 401 });
    }

    // 2. GET - UI
    if (req.method === "GET" && url.pathname === "/") {
      let modelOptions = `
        <option value="deepseek-r1:1.5b">deepseek-r1:1.5b</option>
        <option value="llama3.2:1b">llama3.2:1b</option>
      `;

      try {
        const res = await fetch("http://127.0.0.1:11434/api/chat");
        if (res.ok) {
          const data = await res.json();
          if (data.models?.length > 0) {
            modelOptions = data.models
              .map((m: any) => `<option value="${m.name}">${m.name}</option>`)
              .join("");
          }
        }
      } catch (e) {
        console.error("Ollama not reachable for model list (run 'ollama serve'):", e);
      }

      return new Response(`
        <html><head><style>
          body { background:#000; color:#0f0; font-family:monospace; padding:20px; }
          #term { height:80vh; overflow-y:auto; border:1px solid #333; padding:15px; background:#050505; margin-bottom:10px; }
          .prompt { color:#55f; font-weight:bold; }
          input { background:transparent; border:none; color:#0f0; outline:none; width:70%; font-family:monospace; font-size:1.1rem; }
          select { background:#111; color:#0f0; border:1px solid #333; padding:5px; }
        </style></head><body>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span>Jellyfish AI OS [2025]</span>
            <select id="pk">${modelOptions}</select>
          </div>
          <div id="term"></div>
          <div style="margin-top:15px">
            <span class="prompt">jonathan@Jellyfish:~$</span>
            <input id="cmd" autofocus autocomplete="off">
          </div>
          <script>
  const input = document.getElementById('cmd');
  const term = document.getElementById('term');
  const picker = document.getElementById('pk');
  
  let history = []; 

  input.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (!val) return;
      input.value = '';

      term.innerHTML += '<p><span class="prompt">jonathan@Jellyfish:~$</span> ' + val + '</p>';
      history.push({ role: "user", content: val });
      term.scrollTop = term.scrollHeight;

      try {
        const res = await fetch('/ask', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ messages: history, model: picker.value }) 
        });
        
        if (!res.ok) throw new Error('Server error ' + res.status);
        
        const text = await res.text();
        if (!text.trim()) throw new Error('Empty AI response');
        
        history.push({ role: "assistant", content: text });

        term.innerHTML += '<div style="color:white; margin:10px 0 20px 20px; border-left:2px solid #333; padding-left:10px; white-space: pre-wrap;">' + 
          picker.value + '@ai: ' + text.replace(/<think>[\\s\\S]*?<\\/think>/g, '').trim() + '</div>';
      } catch (err) {
        term.innerHTML += '<p style="color:red">Error: ' + (err.message || 'Ollama unreachable - run "ollama serve"') + '</p>';
      }
      term.scrollTop = term.scrollHeight;
    }
  });
</script>
        </body></html>`, { headers: { "Content-Type": "text/html" } });
    }

    // 3. POST - /ask proxy to Ollama
    if (req.method === "POST" && url.pathname === "/ask") {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      try {
        const ollamaRes = await fetch("http://127.0.0.1:11434/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: body.model || "llama3.2:1b",
            messages: body.messages || [],
            stream: false,
            options: { num_ctx: 4096 }
          })
        });

        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          throw new Error(`Ollama ${ollamaRes.status}: ${errText}`);
        }

        const data = await ollamaRes.json();
        let aiText = data.message?.content || "[No content]";
        aiText = aiText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

        return new Response(aiText);
      } catch (err) {
        console.error("Ollama proxy failed:", err);
        return new Response(`Ollama error: ${err.message || "unreachable - start with 'ollama serve'"}`, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log("🚀 Jellyfish AI OS running on http://localhost:3001");
console.log("   Use Basic Auth: Jonathan / JonathanAndJames");