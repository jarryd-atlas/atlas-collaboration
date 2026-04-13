export default function CustomerLoading() {
  return (
    <div className="-mx-6 -mt-6 -mb-6 flex flex-col overflow-hidden animate-pulse" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Header skeleton */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="h-6 w-40 bg-gray-200 rounded" />
          <div className="h-5 w-24 bg-gray-100 rounded-full" />
        </div>
        <div className="flex items-center gap-4 mt-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 w-16 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
      {/* Tab bar skeleton */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-white">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-20 bg-gray-100 rounded" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-40 bg-gray-50 rounded-xl" />
          <div className="h-40 bg-gray-50 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
