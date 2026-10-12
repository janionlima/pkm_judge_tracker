import { defineConfig } from "vite";

export default defineConfig({
  // base relativa para que o build sirva a partir de arquivos estáticos
  // (abrir o index.html em qualquer caminho / host simples).
  base: "./",
  server: {
    host: true, // expõe na rede local para testar no celular
    port: 5173,
  },
  test: {
    // Ambiente padrão: node (puro, rápido) para domínio e serviços.
    // Arquivos que precisam de DOM/localStorage declaram
    //   // @vitest-environment jsdom
    // no topo do próprio arquivo de teste.
    environment: "node",
    include: ["test/**/*.{test,spec}.js"],
    globals: false,
  },
});
