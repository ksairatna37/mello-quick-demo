import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import HumeVoiceProvider from "@/components/HumeVoiceProvider";
import "./index.css";

const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(userAgent);
const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|EdgiOS|FxiOS/.test(userAgent);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HumeVoiceProvider enableAudioWorklet={!(isIOS || isSafari)}>
      <App />
    </HumeVoiceProvider>
  </React.StrictMode>,
);
