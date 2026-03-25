import { BiLogoGmail } from "react-icons/bi";

export type Route = {
  path: string;
  id: string;
  icon: string;
  label: string;
  loadURL: string;
  partition: string;
  internalHosts?: string[];
  openExternalLinksInBrowser?: boolean;
};

// refactor this to store/settings so it is not hardcoded and can be edited
const routes = [
  {
    path: "/facebook",
    id: "facebook",
    icon: "facebook", // propably cannot use react/svg on server-side/electron main thread
    label: "Facebook",
    loadURL: "https://facebook.com/messages",
    partition: "persist:gmail-facebook",
    internalHosts: ["facebook.com", "messenger.com", "fbcdn.net", "fbsbx.com"],
  },
  {
    path: "/gmail1",
    id: "gmail1",
    icon: "gmail",
    label: "Gmail 1",
    loadURL: "https://mail.google.com",
    partition: "persist:gmail-gmail1",
    openExternalLinksInBrowser: false,
    internalHosts: [
      "mail.google.com",
      "google.com",
      "googleapis.com",
      "googleusercontent.com",
      "gstatic.com",
    ],
  },
  {
    path: "/gmail2",
    id: "gmail2",
    icon: "gmail",
    label: "Gmail 2",
    loadURL: "https://mail.google.com",
    partition: "persist:gmail-gmail2",
    openExternalLinksInBrowser: false,
    internalHosts: [
      "mail.google.com",
      "google.com",
      "googleapis.com",
      "googleusercontent.com",
      "gstatic.com",
    ],
  },
  {
    path: "/gmail3",
    id: "gmail3",
    icon: "gmail",
    label: "Gmail 3",
    loadURL: "https://mail.google.com",
    partition: "persist:gmail-gmail3",
    openExternalLinksInBrowser: false,
    internalHosts: [
      "mail.google.com",
      "google.com",
      "googleapis.com",
      "googleusercontent.com",
      "gstatic.com",
    ],
  },
  {
    path: "/discord1",
    id: "discord1",
    icon: "discord",
    label: "Discord",
    loadURL: "https://discord.com/channels/@me",
    partition: "persist:discord-discord1",
    internalHosts: ["discord.com", "discordapp.com"],
  },
];

export default routes;
