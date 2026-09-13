import { Link, useLocation } from "react-router-dom";
import { useGetCategoriesQuery } from "../../features/admin/categories/api/categoriesApi";

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
    <nav className="fixed top-16 w-full z-40 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between h-11 gap-4">

        {/* Category links */}
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide flex-1 min-w-0">
          {isLoading ? (
            <div className="flex gap-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              ))}
            </div>
          ) : (
            categories.map((category) => {
              const isActive = location.pathname === `/category/${category.slug}`;
              return (
                <Link
                  key={category._id}
                  to={`/category/${category.slug}`}
                  className={`whitespace-nowrap text-sm font-medium capitalize transition-colors ${
                    isActive
                      ? "text-(--color-primary-700) font-semibold"
                      : "text-gray-700 dark:text-gray-300 hover:text-(--color-primary-700)"
                  }`}
                >
                  {category.name}
                </Link>
              );
            })
          )}
        </div>

        {/* Free Shipping button */}
        <button className="shrink-0 text-sm font-semibold text-white bg-(--color-primary-700) hover:bg-(--color-primary-800) px-4 py-1.5 rounded transition-colors">
          Free Shipping Order By August
        </button>

      </div>
    </nav>
  );
}
