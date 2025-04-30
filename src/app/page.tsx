import EmotionDetector from '@/components/emotion-detector';

export default function Home() {
  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 text-primary">
        EmotiVision
      </h1>
      <p className="text-center text-muted-foreground mb-8">
        Upload an image to detect the predominant emotion using AI.
      </p>
      <EmotionDetector />
    </div>
  );
}
