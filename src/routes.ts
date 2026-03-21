export type Route = {
  path: string;
  id: string;
  icon: string;
  label: string;
  loadURL: string;
  partition: string;
};

const routes = [
  {
    path: "/facebook",
    id: "facebook",
    icon: "Stuff",
    label: "Facebook",
    loadURL: "https://facebook.com/messages",
    partition: "persist:gmail-facebook",
  },
  {
    path: "/gmail1",
    id: "gmail1",
    icon: "Stuff",
    label: "Gmail 1",
    loadURL: "https://mail.google.com",
    partition: "persist:gmail-gmail1",
  },
  {
    path: "/gmail2",
    id: "gmail2",
    icon: "Stuff",
    label: "Gmail 2",
    loadURL: "https://mail.google.com",
    partition: "persist:gmail-gmail2",
  },
];

export default routes;
