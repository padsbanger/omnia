import { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import Sidemenu from "./Sidemenu";

const Layout = ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-blue-500 w-full h-full flex">
      <Sidemenu />
      <div className="w-full h-full">
        <button
          onClick={() => {
            window.electronAPI.invoke("clear-partitions");
          }}
        >
          Clear partions
        </button>
        {children}
      </div>
    </div>
  );
};

export default Layout;
