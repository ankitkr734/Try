"use client";

import React, { useState, useRef, useEffect } from 'react';
import { analyzeEmotionFromImage, type AnalyzeEmotionFromImageOutput } from '@/ai/flows/analyze-emotion-from-image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from "@/hooks/use-toast";
import { Upload, Smile, Frown, Angry, Meh, Annoyed, SmilePlus, Loader2, AlertCircle, Video, CameraOff } from 'lucide-react'; // Removed Image icon, Added Video, CameraOff

// Define the type for emotion results
type EmotionResult = AnalyzeEmotionFromImageOutput | null;

// Helper function to map emotion string to icon
const getEmotionIcon = (emotion?: string): React.ReactNode => {
  if (!emotion) return <Meh className="w-6 h-6 text-muted-foreground" />;
  const lowerCaseEmotion = emotion.toLowerCase();
  switch (lowerCaseEmotion) {
    case 'joy':
    case 'happy':
      return <Smile className="w-6 h-6 text-green-500" />;
    case 'sadness':
    case 'sad':
      return <Frown className="w-6 h-6 text-blue-500" />;
    case 'anger':
    case 'angry':
      return <Angry className="w-6 h-6 text-red-500" />;
    case 'surprise':
    case 'surprised':
       return <SmilePlus className="w-6 h-6 text-yellow-500" />; // Used SmilePlus for Surprise
    case 'fear':
       return <Annoyed className="w-6 h-6 text-purple-500" />; // Using Annoyed for Fear as lucide lacks a specific 'Fear' icon
    case 'neutral':
    default:
      return <Meh className="w-6 h-6 text-gray-500" />;
  }
};

export default function EmotionDetector() {
  const [result, setResult] = useState<EmotionResult>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); // null initially, true/false after check
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setError("Failed to access webcam. Please ensure you have a webcam and grant permissions in your browser settings.");
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();

    // Cleanup function to stop video stream when component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [toast]); // Added toast dependency


  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !hasCameraPermission) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
        console.error("Could not get canvas context");
        return null;
    }

    // Set canvas dimensions to match video feed for accurate capture
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame onto the hidden canvas
    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    // Convert the canvas content to a JPEG data URI
    // Use JPEG for smaller file size compared to PNG, suitable for analysis
    try {
        const dataUri = canvas.toDataURL('image/jpeg', 0.9); // Quality 0.9
        return dataUri;
    } catch (e) {
        console.error("Error converting canvas to data URL:", e);
        setError("Failed to capture frame from video feed.");
        return null;
    }
  };

  const handleAnalyzeClick = async () => {
    if (!hasCameraPermission) {
      toast({
        title: "Webcam Required",
        description: "Please enable webcam access to analyze live feed.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null); // Clear previous result when starting new analysis

    try {
      const photoDataUri = captureFrame();
      if (!photoDataUri) {
        throw new Error('Could not capture frame from webcam.');
      }

      const analysisResult = await analyzeEmotionFromImage({ photoDataUri });
      setResult(analysisResult);
      toast({
        title: "Analysis Complete",
        description: `Detected emotion: ${analysisResult.emotion}`,
      });
    } catch (err) {
      console.error("Error analyzing emotion:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
      setError(`Analysis failed: ${errorMessage}`);
      toast({
        title: "Analysis Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Card className="w-full shadow-lg rounded-xl overflow-hidden">
      <CardHeader>
        <CardTitle className="text-center text-xl md:text-2xl font-semibold text-primary">Live Emotion Detection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && hasCameraPermission === false && ( // Show specific error if camera permission denied
          <Alert variant="destructive">
            <CameraOff className="h-4 w-4" />
            <AlertTitle>Camera Access Required</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
         {error && hasCameraPermission !== false && ( // Show general analysis errors
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}


        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-full aspect-video bg-secondary rounded-lg flex items-center justify-center border-2 border-dashed border-border overflow-hidden">
             {/* Always render video tag to prevent issues, but hide if no permission */}
             <video
                ref={videoRef}
                autoPlay
                muted // Mute video to avoid feedback loop if audio was enabled
                playsInline // Important for mobile browsers
                className={`w-full h-full object-cover ${hasCameraPermission ? 'block' : 'hidden'}`}
             />
             {/* Hidden canvas for frame capture */}
             <canvas ref={canvasRef} className="hidden" />

             {/* Loading/Permission State Indicators */}
             {hasCameraPermission === null && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-secondary/80">
                    <Loader2 className="w-12 h-12 animate-spin mb-2" />
                    <p>Checking camera access...</p>
                </div>
             )}
             {hasCameraPermission === false && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive-foreground bg-destructive/80 p-4 text-center">
                    <CameraOff className="w-12 h-12 mb-2" />
                    <p>Camera access denied or unavailable.</p>
                    <p className="text-xs mt-1">Please grant permission in your browser settings.</p>
                </div>
             )}
          </div>
        </div>


        <Button
          onClick={handleAnalyzeClick}
          disabled={!hasCameraPermission || isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          aria-live="polite"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing Feed...
            </>
          ) : (
            <>
              <Video className="mr-2 h-4 w-4" />
              Analyze Webcam Feed
            </>
          )}
        </Button>

        {isLoading && (
            <Progress value={undefined} indicatorClassName="animate-pulse bg-primary" className="w-full h-2" /> // Indeterminate progress
        )}

        {result && !isLoading && (
          <Card className="bg-secondary rounded-lg p-4 shadow-inner">
            <CardHeader className="p-2 pb-0">
               <CardTitle className="text-lg font-semibold text-center text-accent">Analysis Result</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-2 p-2">
               <div className="flex items-center space-x-2">
                 {getEmotionIcon(result.emotion)}
                 <span className="text-xl font-medium capitalize">{result.emotion || 'Unknown'}</span>
               </div>
               <div className="w-full">
                 <div className="flex justify-between text-sm mb-1">
                   <span>Confidence</span>
                   <span>{`${(result.confidence * 100).toFixed(1)}%`}</span>
                 </div>
                 <Progress value={result.confidence * 100} indicatorClassName="bg-accent" className="w-full h-2" />
               </div>
            </CardContent>
           </Card>
        )}
      </CardContent>
       <CardFooter className="text-xs text-muted-foreground text-center p-4 pt-0">
           AI analysis provides an estimate based on a single frame. Results may vary based on lighting, expression clarity, and angle.
        </CardFooter>
    </Card>
  );
}
