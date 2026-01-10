const USERS = { 
   "Jonathan": "JonathanAndJames",
   "James": "JamesPassword2025",
   "Wen": "WenPassword2025"
};

const server = Bun.serve({
  port: 3000,
  hostname: "0.0.0.0", // This makes it listen on your 10.0.0.x IP
  async fetch(req) {
    const url = new URL(req.url);
    const auth = req.headers.get("Authorization");

    // MULTI-USER LOGIN CHECK
    let isAuthorized = false;
    if (auth && auth.startsWith("Basic ")) {
      const credentials = atob(auth.split(" ")[1]); // Decodes "user:pass"
      const [username, password] = credentials.split(":");

 // Check if the user exists and the password matches
      if (USERS[username] && USERS[username] === password) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Bun File Manager"' },
      });
    }

    // 2. Delete Handler
    if (req.method === "DELETE" && url.pathname.startsWith("/delete/")) {
      const fileName = decodeURIComponent(url.pathname.slice(8));
      try {
        const { unlink } = require("node:fs/promises");
        await unlink(`./uploads/${fileName}`);
        return new Response("Deleted");
      } catch (e) {
        return new Response("Error deleting", { status: 500 });
      }
    }

    // 3. Web Interface
    if (req.method === "GET" && url.pathname === "/") {
      return new Response(`
        <html>
          <body style="font-family: sans-serif; padding: 2rem;">
            <h1>📂 Bun File Manager</h1>
            <form action="/upload" method="POST" enctype="multipart/form-data">
              <input type="file" name="file" required />
              <button type="submit">Upload</button>
            </form>
            <hr />
            <ul id="file-list"></ul>
            <script>
              async function deleteFile(name) {
                if (confirm('Delete ' + name + '?')) {
                  await fetch('/delete/' + encodeURIComponent(name), { method: 'DELETE' });
                  location.reload();
                }
              }
              fetch('/api/list').then(r => r.json()).then(files => {
                const list = document.getElementById('file-list');
                list.innerHTML = files.map(f => \`
                  <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #ddd;">
                    <a href="/\${encodeURIComponent(f)}" target="_blank">\${f}</a>
                    <button onclick="deleteFile('\${f.replace(/'/g, "\\\\'")}')" style="background: #dc3545; color: white; border: none; padding: 5px; cursor: pointer; border-radius: 4px;">Delete</button>
                  </li>
                \`).join('');
              });
            </script>
          </body>
        </html>
      `, { headers: { "Content-Type": "text/html" } });
    }

    // 4. API & Upload Logic
    if (url.pathname === "/api/list") {
      const { readdir } = require("node:fs/promises");
      const files = await readdir("./uploads");
      return Response.json(files);
    }

    if (req.method === "POST" && url.pathname === "/upload") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (file) await Bun.write(`./uploads/${file.name}`, file);
      return Response.redirect("/");
    }

    // 5. Download Logic
    const fileName = decodeURIComponent(url.pathname.slice(1));
    const file = Bun.file(`./uploads/${fileName}`);
    return (await file.exists()) ? new Response(file) : new Response("Not Found", { status: 404 });
  },
});

console.log("🚀 Secure Manager at http://localhost:3000 (User: Jonathan, Pass: JonathanAndJames)");
