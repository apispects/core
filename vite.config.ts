import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'apispects',
      fileName: (format) => `apispects.${format}.js`, // Output file name
    },
    rollupOptions: {
      external: ['zod'],
      output: {
        globals: {
          'some-external-dependency': 'SomeExternalDependency',
        },
      },
    },
  },
});