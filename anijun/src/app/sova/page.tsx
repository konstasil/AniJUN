"use client";

export default function SovaPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-lg font-bold text-sky-400 mb-4">
          Шутки шутками, смех смехом,
        </h1>
        <p className="text-gray-300 text-sm max-w-md mb-6">
          но всё веселье заканчивается, когда сова на скакалке попадается
        </p>
        <iframe 
          width="560" 
          height="315" 
          src="https://www.youtube.com/embed/K5kfARwRz88?si=nJ5oHiGdq7w9Hk6O" 
          title="YouTube video player" 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          referrerPolicy="strict-origin-when-cross-origin" 
          allowFullScreen
          className="rounded-lg mb-6"
        />
      </div>
    </div>
  );
}
