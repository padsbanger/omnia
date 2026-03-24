import { PropsWithChildren } from "react";
import Sidemenu from "./Sidemenu";

const Layout = ({ children }: PropsWithChildren) => {
  return (
    <div className="w-full h-full flex">
      <Sidemenu />
      <div className="w-full h-full z-0">{children}</div>
    </div>
  );
};

export default Layout;
