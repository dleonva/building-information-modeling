import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

// Configuración para obtener la ruta del directorio actual en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Creamos el servidor de Vite en modo middleware
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  // Usamos el middleware de Vite para manejar las peticiones
  app.use(vite.middlewares);

  // Iniciamos el servidor en el puerto 3000 (requerido por la plataforma)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor BIM Designer ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

// Iniciamos el proceso
startServer().catch((err) => {
  console.error("Error al iniciar el servidor:", err);
});
