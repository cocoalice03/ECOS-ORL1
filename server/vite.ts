import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Resolve user vite config (it exports a function via defineConfig)
  const mode = process.env.NODE_ENV || "development";
  const userConfig =
    typeof (viteConfig as any) === "function"
      ? (viteConfig as any)({ mode, command: "serve" })
      : (viteConfig as any);

  const vite = await createViteServer({
    ...(userConfig || {}),
    // Force the correct project root for dev server
    root: path.resolve(__dirname, "..", "client"),
    configFile: false,
    server: {
      ...((userConfig && userConfig.server) || {}),
      middlewareMode: true,
      hmr: { server },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Better file detection: ensure Vite can serve dev modules and assets.
    // - Let Vite handle special dev paths like /src/*, /@vite, /@fs, and optimized deps.
    // - Include TS/TSX/JSX and other common assets in extension detection.
    const pathname = url.split('?')[0]; // Remove query params for check
    const isViteDevPath =
      pathname.startsWith('/src/') ||
      pathname.startsWith('/@vite') ||
      pathname.startsWith('/@fs/') ||
      pathname.startsWith('/node_modules/.vite');

    const fileExtensionPattern = /\.(m?js|jsx|ts|tsx|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json|txt|xml)$/i;
    const isAssetRequest = isViteDevPath || fileExtensionPattern.test(pathname);

    if (isAssetRequest) {
      return next();
    }

    try {
      let template = fs.readFileSync(
        path.resolve(path.resolve(__dirname, "..", "client"), "index.html"),
        "utf-8",
      );

      template = await vite.transformIndexHtml(url, template);

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
