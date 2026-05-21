import { createApp } from "vue";
import { createPinia } from "pinia";
import { addCollection } from "@iconify/vue";
import lucideIcons from "@iconify-json/lucide/icons.json";
import App from "./App.vue";
import "./styles/tailwind.css";
import "./styles/main.scss";

addCollection(lucideIcons);

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
