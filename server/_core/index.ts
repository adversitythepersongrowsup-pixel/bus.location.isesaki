import "dotenv/config";
import express from "express";
import { exec } from "child_process";
import path from "path";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sseHandler } from "../sse";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // SSE endpoint
  app.get("/api/sse", sseHandler);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    const baseUrl = `http://localhost:${port}/`;
    console.log(`Server running on ${baseUrl}`);

    const auto = (process.env.AUTO_OPEN_BROWSER || "").toLowerCase();
    if (auto === "1" || auto === "true") {
      try {
        const openPath = process.env.AUTO_OPEN_PATH || "/pages";
        const openUrl = new URL(openPath, baseUrl).toString();
        const plat = process.platform;
        if (plat === "win32") {
          exec(`start "" "${openUrl.replace(/"/g, '\\"')}"`);
        } else if (plat === "darwin") {
          exec(`open "${openUrl.replace(/"/g, '\\"')}"`);
        } else {
          exec(`xdg-open "${openUrl.replace(/"/g, '\\"')}"`);
        }
      } catch (e) {
        console.error("Failed to open browser:", e);
      }
    }
  });
}

startServer().catch(console.error);
