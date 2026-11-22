import { hydrateRoot } from "react-dom/client";
import CitizenGame from "./CitizenGame.tsx";
import { readConfig } from "./config.ts";

const root = document.getElementById("root");
if (root) hydrateRoot(root, <CitizenGame config={readConfig()} />);
