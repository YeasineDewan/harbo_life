import { Link } from "react-router-dom";
import SearchBar from "./components/SearchBar";
import DesktopNav from "./components/DesktopNav";
import MobileMenu from "./components/MobileMenu";
import NotificationDropdown from "../../features/notifications/components/NotificationDropdown";
import { useSelector } from "react-redux";

const SUB_NAV_LINKS = [
  { label: "Diabetes Care", to: "/categories/diabetes-care" },
  { label: "First Aid", to: "/categories/first-aid" },
  { label: "Pain Relief", to: "/categories/pain-relief" },
  { label: "Cold And Flu", to: "/categories/cold-and-flu" },
];

export default function Header() {
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <nav className="fixed top-0 w-full z-50 bg-(--color-primary-700) dark:bg-(--color-primary-900) text-white shadow-md transition-colors duration-300">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/"
            aria-label="Harbolife Home"
            className="font-['Pacifico'] text-3xl tracking-wide text-white flex-shrink-0 hover:opacity-90 transition-opacity"
          >
            Harbolife
          </Link>

          <div className="hidden md:flex flex-1 w-full mx-6 lg:mx-12">
            <SearchBar id="desktop-search" />
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <div className="text-white">
                <NotificationDropdown />
              </div>
            )}
            <DesktopNav />
            <MobileMenu />
          </div>
        </div>
      </div>
      {/* Sub-header */}
      <div className="w-full bg-white dark:bg-(--color-primary-950) border-b border-gray-200 dark:border-(--color-primary-800)">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between h-10">
          <div className="flex items-center gap-8">
            {SUB_NAV_LINKS.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-(--color-primary-700) transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
          <span className="ml-auto text-sm font-semibold text-white bg-(--color-primary-700) px-4 py-1 rounded">
            Free Shipping Order By August
          </span>
        </div>
      </div>
    </nav>
  );
}
