/// <reference types="vite/client" />

declare module 'markdown-it-task-lists';

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
