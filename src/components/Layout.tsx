import { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import routes from "../routes";

const Layout = ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-blue-500 w-full h-full flex">
      <div className="w-[100px] h-full bg-red-600 flex flex-col">
        {routes.map((route) => (
          <Link to={route.path} key={route.id}>
            {route.label}
          </Link>
        ))}
      </div>
      <div className="w-full h-full">
        <button onClick={() => {
          window.electronAPI.invoke("clear-partitions");
        }}>Clear partions</button>
        {children}
      </div>
    </div>
  );
};

export default Layout;
