import { Link, useLocation } from "react-router-dom";
import { useGetCategoriesQuery } from "../../features/admin/categories/api/categoriesApi";
import { Truck } from "lucide-react";

const FALLBACK_CATEGORIES = [
  { _id: "fallback-diabetes-care", name: "Diabetes Care", slug: "diabetes-care" },
  { _id: "fallback-first-aid", name: "First Aid", slug: "first-aid" },
  { _id: "fallback-pain-relief", name: "Pain Relief", slug: "pain-relief" },
  { _id: "fallback-cold-and-flu", name: "Cold And Flu", slug: "cold-and-flu" },
];

export default function SubNavbar() {
  const { data, isLoading } = useGetCategoriesQuery();
  const location = useLocation();
  const apiCategories = data?.data || [];
  const categories = apiCategories.length > 0 ? apiCategories : FALLBACK_CATEGORIES;

  return (
    <nav className="fixed top-16 w-full z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between h-11 gap-4">

        {/* Category links */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0">
          {isLoading ? (
            <div className="flex gap-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              ))}
            </div>
          ) : (
            categories.map((category) => {
              const isActive = location.pathname === `/category/${category.slug}`;
              return (
                <Link
                  key={category._id}
                  to={`/category/${category.slug}`}
                  className={`whitespace-nowrap px-3 py-1 rounded text-sm font-medium capitalize transition-colors ${
                    isActive
                      ? "bg-(--color-primary-700) text-white"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {category.name}
                </Link>
              );
            })
          )}
        </div>

        {/* Promo badge */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-(--color-primary-700) dark:text-blue-400 whitespace-nowrap shrink-0">
          <Truck className="w-3.5 h-3.5" />
          Free Shipping · Orders over EGP 200
        </div>

      </div>
    </nav>
  );
}
