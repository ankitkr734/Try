
"use client";

import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import Image from 'next/image'; // Import next/image
import { analyzeEmotionFromImage, type AnalyzeEmotionFromImageOutput } from '@/ai/flows/analyze-emotion-from-image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components
import { useToast } from "@/hooks/use-toast";
import { Smile, Frown, Angry, Meh, Annoyed, SmilePlus, Loader2, AlertCircle, Video, CameraOff, Upload, Image as ImageIcon, RotateCcw } from 'lucide-react'; // Added ImageIcon, Upload, RotateCcw

// Define the type for emotion results
type EmotionResult = AnalyzeEmotionFromImageOutput | null;
type AnalysisMode = 'webcam' | 'image';

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
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('webcam');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImageDataUri, setSelectedImageDataUri] = useState<string | null>(null);
  const [showResetButton, setShowResetButton] = useState<boolean>(false); // State for reset button visibility

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const stopWebcamStream = useCallback(() => {
     if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        // Explicitly set permission state back if needed, or handle based on whether stream stopped
        // setHasCameraPermission(null); // Or false, depending on desired UX
      }
  }, []);

  const startWebcamStream = useCallback(async () => {
    if (hasCameraPermission === false) return; // Don't try if permission denied

    setError(null); // Clear previous errors
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
        description: 'Please enable camera permissions in your browser settings to use this feature.',
      });
    }
  }, [hasCameraPermission, toast]);

  useEffect(() => {
    // Start webcam only if in webcam mode initially or when switched back
    if (analysisMode === 'webcam') {
      startWebcamStream();
    }

    // Cleanup function
    return () => {
      stopWebcamStream();
    };
  }, [analysisMode, startWebcamStream, stopWebcamStream]); // Rerun effect when mode changes


  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !hasCameraPermission) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
        console.error("Could not get canvas context");
        return null;
    }

    // Set canvas size based on video dimensions for accurate capture
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    try {
        // Use a lower quality setting if needed for performance, e.g., 0.8
        const dataUri = canvas.toDataURL('image/jpeg', 0.9);
        return dataUri;
    } catch (e) {
        console.error("Error converting canvas to data URL:", e);
        setError("Failed to capture frame from video feed.");
        return null;
    }
  };


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      setError(null); // Clear previous errors
      setResult(null); // Clear previous results
      setShowResetButton(false); // Hide reset button when new file is selected

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImageDataUri(reader.result as string);
      };
      reader.onerror = () => {
         setError("Failed to read the selected image file.");
         setSelectedImageDataUri(null);
         setSelectedImageFile(null);
      }
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeClick = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null); // Clear previous result
    setShowResetButton(false); // Hide reset initially

    let photoDataUri: string | null = null;

    try {
      if (analysisMode === 'image') {
        if (!selectedImageDataUri) {
          throw new Error('Please select an image file first.');
        }
        photoDataUri = selectedImageDataUri;
      } else { // webcam mode
        if (!hasCameraPermission) {
          throw new Error('Webcam access is required for live analysis.');
        }
        photoDataUri = captureFrame();
        if (!photoDataUri) {
          throw new Error('Could not capture frame from webcam.');
        }
      }

      const analysisResult = await analyzeEmotionFromImage({ photoDataUri });
      setResult(analysisResult);
      setShowResetButton(true); // Show reset button after successful analysis
      toast({
        title: "Analysis Complete",
        description: `Detected emotion: ${analysisResult.emotion}`,
      });
    } catch (err) {
      console.error("Error analyzing emotion:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
      setError(`Analysis failed: ${errorMessage}`);
      setShowResetButton(true); // Also show reset button on error
      toast({
        title: "Analysis Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (value: string) => {
    const newMode = value as AnalysisMode;
    setAnalysisMode(newMode);
    handleReset(); // Reset everything when changing mode
    if (newMode === 'webcam') {
        // Webcam stream is handled by useEffect
    } else {
        stopWebcamStream(); // Stop webcam if switching to image mode
    }
  };

   const handleReset = () => {
    setResult(null);
    setError(null);
    setIsLoading(false);
    setSelectedImageFile(null);
    setSelectedImageDataUri(null);
    setShowResetButton(false);
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Optionally restart webcam if in webcam mode and stopped
    // if (analysisMode === 'webcam' && !videoRef.current?.srcObject) {
    //    startWebcamStream();
    // }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };


  return (
    <Card className="w-full shadow-lg rounded-xl overflow-hidden">
      <CardHeader>
        <CardTitle className="text-center text-xl md:text-2xl font-semibold text-primary">Emotion Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4"> {/* Reduced spacing slightly */}

        <Tabs value={analysisMode} onValueChange={handleModeChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="webcam">
              <Video className="mr-2 h-4 w-4" /> Webcam
            </TabsTrigger>
            <TabsTrigger value="image">
              <ImageIcon className="mr-2 h-4 w-4" /> Image Upload
            </TabsTrigger>
          </TabsList>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              {analysisMode === 'webcam' && hasCameraPermission === false ? <CameraOff className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>
                {analysisMode === 'webcam' && hasCameraPermission === false ? 'Camera Access Required' : 'Error'}
              </AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Webcam Tab Content */}
          <TabsContent value="webcam" className="mt-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-full aspect-video bg-secondary rounded-lg flex items-center justify-center border-2 border-dashed border-border overflow-hidden">
                 {/* Always render video tag, hide if no permission */}
                 <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover transform scaleX(-1) ${hasCameraPermission === true ? 'block' : 'hidden'}`} // Mirror webcam feed
                 />
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
                        <p className="text-xs mt-1">Grant permission or try uploading an image.</p>
                    </div>
                 )}
                 {/* Placeholder when webcam is active but feed might be loading */}
                  {hasCameraPermission === true && !videoRef.current?.srcObject && ( // Check srcObject instead of videoWidth
                     <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-secondary/80">
                        <Loader2 className="w-12 h-12 animate-spin" />
                    </div>
                  )}
              </div>
            </div>
          </TabsContent>

          {/* Image Upload Tab Content */}
          <TabsContent value="image" className="mt-4">
            <div className="flex flex-col items-center space-y-4">
               <div className="relative w-full aspect-video bg-secondary rounded-lg flex items-center justify-center border-2 border-dashed border-border overflow-hidden">
                 {selectedImageDataUri ? (
                   <Image
                     src={selectedImageDataUri}
                     alt="Selected image preview"
                     fill // Use fill and object-contain for better control
                     style={{ objectFit: 'contain' }} // Ensures the whole image is visible
                   />
                 ) : (
                   <div className="text-center text-muted-foreground p-4">
                     <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                     <p>Upload an image to analyze</p>
                   </div>
                 )}
               </div>
               <input
                 type="file"
                 ref={fileInputRef}
                 onChange={handleFileChange}
                 accept="image/*"
                 className="hidden"
               />
               <Button
                 onClick={triggerFileInput}
                 variant="outline"
                 className="w-full"
                 disabled={isLoading}
               >
                 <Upload className="mr-2 h-4 w-4" />
                 {selectedImageFile ? `Change Image (${selectedImageFile.name})` : 'Select Image'}
               </Button>
             </div>
          </TabsContent>
        </Tabs>


        {/* Action Buttons Container */}
        <div className="flex flex-col sm:flex-row gap-2">
            {/* Analyze Button */}
            <Button
              onClick={handleAnalyzeClick}
              disabled={
                isLoading ||
                (analysisMode === 'webcam' && !hasCameraPermission) ||
                (analysisMode === 'image' && !selectedImageDataUri)
              }
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" // flex-1 makes it grow
              aria-live="polite"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  {analysisMode === 'webcam' ? <Video className="mr-2 h-4 w-4" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                  {analysisMode === 'webcam' ? 'Analyze Webcam Feed' : 'Analyze Uploaded Image'}
                </>
              )}
            </Button>

             {/* Reset Button */}
            {showResetButton && (
                <Button
                onClick={handleReset}
                variant="outline"
                disabled={isLoading}
                className="flex-none" // flex-none prevents it from growing
                >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
                </Button>
            )}
        </div>


        {/* Progress Indicator */}
        {isLoading && (
            <Progress value={undefined} indicatorClassName="animate-pulse bg-primary" className="w-full h-2" />
        )}

        {/* Result Display */}
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
           AI analysis provides an estimate based on {analysisMode === 'webcam' ? 'a single frame' : 'the uploaded image'}. Results may vary based on lighting, expression clarity, and angle.
        </CardFooter>
    </Card>
  );
}


    