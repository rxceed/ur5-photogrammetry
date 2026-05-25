import { serve } from "bun";
import index from "./index.html";
import { readdirSync, existsSync } from "fs";
import path from "path";

// ─── Helpers ────────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"]);

/** Default directory: <project root>/dataset/images */
const PROJECT_ROOT = path.resolve(import.meta.dir, "../../");
const DEFAULT_IMAGE_DIR = path.join(PROJECT_ROOT, "dataset", "images");

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

/** Safely resolve a requested directory, defaulting to DEFAULT_IMAGE_DIR */
function resolveDir(rawDir?: string | null): string {
  if (!rawDir) return DEFAULT_IMAGE_DIR;
  // Allow absolute paths only (no traversal tricks beyond what exists)
  const resolved = path.resolve(rawDir);
  return resolved;
}

// ─── Server ─────────────────────────────────────────────────────────────────

const server = serve({
  port: 4001,
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async req => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    /**
     * GET /api/list-images?dir=<absolute_path>
     * Returns: { dir: string, images: { name: string, path: string }[] }
     */
    "/api/list-images": async (req) => {
      const url = new URL(req.url);
      const requestedDir = url.searchParams.get("dir");
      const dir = resolveDir(requestedDir);

      if (!existsSync(dir)) {
        return Response.json({ error: `Directory not found: ${dir}` }, { status: 404 });
      }

      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        const images = entries
          .filter(e => e.isFile() && isImageFile(e.name))
          .map(e => ({
            name: e.name,
            path: path.join(dir, e.name),
          }));

        return Response.json({ dir, defaultDir: DEFAULT_IMAGE_DIR, images });
      } catch (err) {
        return Response.json({ error: String(err) }, { status: 500 });
      }
    },

    /**
     * GET /api/get-image?path=<absolute_path>
     * Streams the image file for preview.
     */
    "/api/get-image": async (req) => {
      const url = new URL(req.url);
      const filePath = url.searchParams.get("path");

      if (!filePath) {
        return new Response("Missing path parameter", { status: 400 });
      }

      const resolved = path.resolve(filePath);

      if (!existsSync(resolved) || !isImageFile(resolved)) {
        return new Response("File not found or not an image", { status: 404 });
      }

      const file = Bun.file(resolved);
      return new Response(file);
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
