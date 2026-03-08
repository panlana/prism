import { createApp } from "vue";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import ToastService from "primevue/toastservice";
import ConfirmationService from "primevue/confirmationservice";

import App from "./App.vue";
import { router } from "./router";
import "./styles.css";

const app = createApp(App);

app.use(router);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(PrimeVue as any, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: ".dark",
    },
  },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(ToastService as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(ConfirmationService as any);

app.mount("#app");
