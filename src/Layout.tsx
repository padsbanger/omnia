import { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

const Layout = ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-blue-500 w-full h-full flex">
      <div className="w-[100px] h-full bg-red-600 flex flex-col">
        <Link to="/gmail1">Gmail 1</Link>
        <Link to="/gmail2">Gmail 2</Link>
      </div>
      <div className="w-full h-full">{children}</div>
    </div>
  );
};

export default Layout;
