import { Link } from "react-router-dom";
import routes from "../routes";

const Sidemenu = () => {
  return (
    <div className="w-[93px] h-full bg-gray-800 shadow-lg flex flex-col items-center py-4">
      {routes.map((route) => (
        <Link
          to={route.path}
          key={route.id}
          className="w-full text-center py-3 px-2 text-white text-sm font-medium hover:bg-gray-700 transition-colors duration-200 rounded-md mx-2 mb-2 last:mb-0"
        >
          {route.label}
        </Link>
      ))}
      <button
        className="w-full text-center py-3 px-2 text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 transition-colors duration-200 rounded-md mx-2 mt-auto"
        onClick={() => console.log("Add new link")}
      >
        +
      </button>
    </div>
  );
};

export default Sidemenu;
