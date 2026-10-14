import "@fontsource-variable/inter";
import { createApp } from "vue";
import { httpsLocation } from "@shared/https";
import App from "./App.vue";
import "./styles.css";

const target = typeof window === "undefined" ? null : httpsLocation(window.location);
if (target) window.location.replace(target);
else createApp(App).mount("#app");
