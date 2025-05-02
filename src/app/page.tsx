import EmotionDetector from '@/components/emotion-detector';

export default function Home() {
  return (
    <div className="w-full max-w-2xl py-8 md:py-12"> {/* Added vertical padding */}
      <h1 className="text-3xl md:text-5xl font-bold text-center mb-4 text-primary tracking-tight"> {/* Adjusted size, margin, tracking */}
        EmotiVision
      </h1>
      <p className="text-center text-lg text-muted-foreground mb-10 md:mb-12"> {/* Adjusted size and margin */}
        Analyze emotions in real-time using your webcam or by uploading an image.
      </p>
      <EmotionDetector />
    </div>
  );
}
