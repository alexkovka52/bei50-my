export function ForestPlaceholder() {
  return (
    <div className="absolute inset-0 bg-forest" aria-hidden="true">
      <svg className="h-full w-full" viewBox="0 0 520 780" preserveAspectRatio="xMidYMid slice">
        <rect width="520" height="780" fill="#0F2A1D" />
        {Array.from({ length: 16 }, (_, index) => (
          <rect
            key={index}
            x="28"
            y={150 + index * 36}
            width="464"
            height="12"
            rx="4"
            fill={index % 4 === 0 ? "#375534" : "#1C3B2A"}
            transform={`rotate(-8 260 ${156 + index * 36})`}
          />
        ))}
      </svg>
    </div>
  );
}
