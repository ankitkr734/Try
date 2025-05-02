
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

// Helper function to map emotion string to icon using theme colors
const getEmotionIcon = (emotion?: string): React.ReactNode => {
  if (!emotion) return <Meh className="w-6 h-6 text-muted-foreground" />;
  const lowerCaseEmotion = emotion.toLowerCase();
  switch (lowerCaseEmotion) {
    case 'joy':
    case 'happy':
      return <Smile className="w-6 h-6 text-primary" />; // Use theme primary
    case 'sadness':
    case 'sad':
      return <Frown className="w-6 h-6 text-secondary-foreground" />; // Use theme secondary foreground
    case 'anger':
    case 'angry':
      return <Angry className="w-6 h-6 text-destructive" />; // Use theme destructive
    case 'surprise':
    case 'surprised':
       return <SmilePlus className="w-6 h-6 text-accent" />; // Use theme accent
    case 'fear':
       // Annoyed might still be the best visual, use muted foreground
       return <Annoyed className="w-6 h-6 text-muted-foreground/80" />; // Use slightly darker muted foreground
    case 'neutral':
    default:
      return <Meh className="w-6 h-6 text-muted-foreground" />; // Standard muted foreground
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
        // console.log("Webcam stream stopped");
      }
  }, []);

  const startWebcamStream = useCallback(async () => {
    if (hasCameraPermission === false) return; // Don't try if permission denied
    // console.log("Attempting to start webcam stream...");

    setError(null); // Clear previous errors
    try {
      // Ensure any previous stream is stopped before starting a new one
      stopWebcamStream();

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // console.log("Webcam stream started successfully.");
      } else {
        // console.log("Video ref not available when stream was ready.");
        stream.getTracks().forEach(track => track.stop()); // Stop the stream if ref is gone
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
  }, [hasCameraPermission, toast, stopWebcamStream]); // Added stopWebcamStream dependency

  useEffect(() => {
    // Start webcam only if in webcam mode
    if (analysisMode === 'webcam') {
      startWebcamStream();
    } else {
        stopWebcamStream(); // Stop if not in webcam mode
    }

    // Cleanup function ensures stream is stopped when component unmounts or mode changes away from webcam
    return () => {
      // console.log("Cleanup: Stopping webcam stream.");
      stopWebcamStream();
    };
  }, [analysisMode, startWebcamStream, stopWebcamStream]);


  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !hasCameraPermission || !videoRef.current.srcObject || videoRef.current.readyState < videoRef.current.HAVE_METADATA) {
        console.error("Cannot capture frame: Video not ready or permission denied.");
        return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
        console.error("Could not get canvas context");
        return null;
    }

    // Set canvas size based on video dimensions for accurate capture
    // Use a smaller capture resolution for potentially better performance
    const captureWidth = 640;
    const captureHeight = (video.videoHeight / video.videoWidth) * captureWidth;
    canvas.width = captureWidth;
    canvas.height = captureHeight;


    // Mirror the drawing if the video feed is mirrored
    context.save();
    context.scale(-1, 1); // Flip horizontally
    context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height); // Draw mirrored image
    context.restore(); // Restore context to normal


    try {
        // Use JPEG format with quality adjustment
        const dataUri = canvas.toDataURL('image/jpeg', 0.85); // Quality 0.85
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
      // Basic validation for image type (client-side)
      if (!file.type.startsWith('image/')) {
          setError("Invalid file type. Please select an image.");
          toast({
              title: "Invalid File",
              description: "Please upload a valid image file (e.g., JPG, PNG, WEBP).",
              variant: "destructive",
          });
          setSelectedImageFile(null);
          setSelectedImageDataUri(null);
          if (fileInputRef.current) fileInputRef.current.value = ''; // Clear the input
          return;
      }

      // Optional: Add file size limit (e.g., 5MB)
       const maxSizeInBytes = 5 * 1024 * 1024; // 5 MB
       if (file.size > maxSizeInBytes) {
           setError(`File size exceeds the limit of ${maxSizeInBytes / (1024 * 1024)} MB.`);
            toast({
                title: "File Too Large",
                description: `Please upload an image smaller than ${maxSizeInBytes / (1024 * 1024)} MB.`,
                variant: "destructive",
            });
           setSelectedImageFile(null);
           setSelectedImageDataUri(null);
           if (fileInputRef.current) fileInputRef.current.value = ''; // Clear the input
           return;
       }


      setSelectedImageFile(file);
      setError(null); // Clear previous errors
      setResult(null); // Clear previous results
      setShowResetButton(false); // Hide reset button when new file is selected

      const reader = new FileReader();
      reader.onloadstart = () => setIsLoading(true); // Show loading state while reading file
      reader.onloadend = () => {
        setSelectedImageDataUri(reader.result as string);
        setIsLoading(false); // Hide loading state
      };
      reader.onerror = () => {
         setError("Failed to read the selected image file.");
         setSelectedImageDataUri(null);
         setSelectedImageFile(null);
         setIsLoading(false); // Hide loading state
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
          // Attempt to start the stream again if permission might have been granted meanwhile
           await startWebcamStream();
            if (!hasCameraPermission) { // Re-check after attempt
               throw new Error('Webcam access is required for live analysis.');
            }
        }
        photoDataUri = captureFrame();
        if (!photoDataUri) {
          throw new Error('Could not capture frame from webcam. Ensure the webcam is active and not obstructed.');
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
      setError(`${errorMessage}`);
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
    // console.log("Switching mode to:", newMode);
    setAnalysisMode(newMode);
    handleReset(); // Reset everything when changing mode
    // Let useEffect handle starting/stopping the stream
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
    // If switching back to webcam mode, useEffect will handle starting the stream.
    // If resetting within webcam mode, ensure the stream is running if permission exists.
    // if (analysisMode === 'webcam' && hasCameraPermission && !videoRef.current?.srcObject) {
    //     console.log("Resetting: Attempting to restart webcam stream.");
    //     startWebcamStream();
    // }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };


  return (
    <Card className="w-full shadow-xl rounded-2xl overflow-hidden border border-border/50 backdrop-blur-sm bg-card/80 transition-all duration-300"> {/* Enhanced Card styling */}
      <CardHeader className="pb-4 pt-5"> {/* Adjusted padding */}
        <CardTitle className="text-center text-xl md:text-2xl font-semibold text-primary tracking-wide">Emotion Analysis</CardTitle> {/* Added tracking */}
      </CardHeader>
      <CardContent className="space-y-5 px-4 md:px-6 pb-5"> {/* Increased spacing and padding */}

        <Tabs value={analysisMode} onValueChange={handleModeChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/70 rounded-lg"> {/* Slightly muted background */}
            <TabsTrigger value="webcam" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-colors duration-200">
              <Video className="mr-2 h-4 w-4" /> Webcam
            </TabsTrigger>
            <TabsTrigger value="image" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-colors duration-200">
              <ImageIcon className="mr-2 h-4 w-4" /> Image Upload
            </TabsTrigger>
          </TabsList>

          {/* Error Display Area */}
          <div className="mt-4 min-h-[60px]"> {/* Ensure consistent height for error area */}
              {error && (
                <Alert variant="destructive" className="animate-in fade-in duration-300">
                  {analysisMode === 'webcam' && hasCameraPermission === false ? <CameraOff className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>
                    {analysisMode === 'webcam' && hasCameraPermission === false ? 'Camera Access Required' : 'Error'}
                  </AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
          </div>


          {/* Webcam Tab Content */}
          <TabsContent value="webcam" className="mt-0"> {/* Removed default top margin */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-full aspect-video bg-secondary/50 rounded-lg flex items-center justify-center border border-border overflow-hidden shadow-inner">
                 {/* Always render video tag */}
                 <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline // Important for iOS
                    className={`w-full h-full object-cover transform scaleX(-1) transition-opacity duration-300 ${hasCameraPermission === true && videoRef.current?.srcObject ? 'opacity-100' : 'opacity-0'}`} // Mirror webcam feed, fade in
                 />
                 <canvas ref={canvasRef} className="hidden" /> {/* Canvas remains hidden */}

                 {/* Overlays for different states */}
                 <div className={`absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-secondary/90 p-4 text-center transition-opacity duration-300 ${hasCameraPermission === null ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                     <Loader2 className="w-10 h-10 animate-spin mb-3" />
                     <p>Checking camera access...</p>
                 </div>

                 <div className={`absolute inset-0 flex flex-col items-center justify-center text-destructive-foreground bg-destructive/90 p-4 text-center transition-opacity duration-300 ${hasCameraPermission === false ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <CameraOff className="w-10 h-10 mb-3" />
                    <p>Camera access denied or unavailable.</p>
                    <p className="text-xs mt-1">Grant permission or try uploading an image.</p>
                 </div>

                 {/* Placeholder/Loading for when permission is granted but stream isn't ready yet */}
                  <div className={`absolute inset-0 flex items-center justify-center text-muted-foreground bg-secondary/90 transition-opacity duration-300 ${hasCameraPermission === true && !videoRef.current?.srcObject ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                     <Loader2 className="w-10 h-10 animate-spin" />
                 </div>
              </div>
            </div>
          </TabsContent>

          {/* Image Upload Tab Content */}
          <TabsContent value="image" className="mt-0"> {/* Removed default top margin */}
            <div className="flex flex-col items-center space-y-4">
               <div className="relative w-full aspect-video bg-secondary/50 rounded-lg flex items-center justify-center border border-border overflow-hidden shadow-inner transition-all duration-300">
                 {selectedImageDataUri ? (
                   <Image
                     src={selectedImageDataUri}
                     alt="Selected image preview"
                     fill
                     style={{ objectFit: 'contain' }}
                     className="animate-in fade-in duration-500"
                   />
                 ) : (
                   <div className="text-center text-muted-foreground p-4">
                     <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/70" />
                     <p>Upload an image to analyze</p>
                     <p className="text-xs mt-1">(Max 5MB, JPG, PNG, WEBP)</p>
                   </div>
                 )}
                  {/* Loading overlay for file reading */}
                  {isLoading && analysisMode === 'image' && !result && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
                          <Loader2 className="w-10 h-10 animate-spin text-primary" />
                      </div>
                  )}
               </div>
               <input
                 type="file"
                 ref={fileInputRef}
                 onChange={handleFileChange}
                 accept="image/jpeg, image/png, image/webp" // Be more specific
                 className="hidden"
                 aria-label="Upload image file"
               />
               <Button
                 onClick={triggerFileInput}
                 variant="outline"
                 className="w-full hover:bg-accent/10 transition-colors duration-200"
                 disabled={isLoading} // Disable while reading file too
               >
                 <Upload className="mr-2 h-4 w-4" />
                 {selectedImageFile ? `Change Image: ${selectedImageFile.name}` : 'Select Image'}
               </Button>
             </div>
          </TabsContent>
        </Tabs>


        {/* Action Buttons Container */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2"> {/* Added gap and padding-top */}
            {/* Analyze Button */}
            <Button
              onClick={handleAnalyzeClick}
              disabled={
                isLoading ||
                (analysisMode === 'webcam' && hasCameraPermission !== true) || // Stricter check
                (analysisMode === 'image' && !selectedImageDataUri)
              }
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-base py-3 transition-all duration-200 transform hover:scale-[1.02] focus:scale-[1.02] shadow-md hover:shadow-lg" // Enhanced styling
              aria-live="polite"
              aria-label={`Analyze ${analysisMode === 'webcam' ? 'webcam feed' : 'uploaded image'}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {/* Slightly larger spinner */}
                  Analyzing...
                </>
              ) : (
                <>
                  {analysisMode === 'webcam' ? <Video className="mr-2 h-5 w-5" /> : <ImageIcon className="mr-2 h-5 w-5" />} {/* Slightly larger icons */}
                  {analysisMode === 'webcam' ? 'Analyze Webcam Feed' : 'Analyze Uploaded Image'}
                </>
              )}
            </Button>

             {/* Reset Button - Conditionally Rendered */}
            {showResetButton && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  disabled={isLoading}
                  className="flex-none rounded-lg text-base py-3 border-border hover:bg-muted/50 transition-colors duration-200" // Enhanced styling
                  aria-label="Reset analysis"
                >
                  <RotateCcw className="mr-2 h-5 w-5" /> {/* Slightly larger icon */}
                  Reset
                </Button>
            )}
        </div>


        {/* Progress Indicator during AI analysis */}
        {isLoading && !result && ( // Only show progress bar during actual analysis, not file reading
             <Progress value={undefined} indicatorClassName="animate-pulse bg-primary" className="w-full h-1.5 rounded-full" /> // Slimmer progress bar
        )}

        {/* Result Display Area */}
         <div className="mt-4 min-h-[130px]"> {/* Consistent height for results */}
            {result && !isLoading && (
              <Card className="bg-secondary/70 rounded-lg p-4 shadow-inner animate-in fade-in duration-500">
                <CardHeader className="p-2 pb-1">
                   <CardTitle className="text-lg font-semibold text-center text-foreground">Analysis Result</CardTitle> {/* Use foreground */}
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-3 p-2 pt-1">
                   <div className="flex items-center space-x-3">
                     {getEmotionIcon(result.emotion)}
                     <span className="text-2xl font-medium capitalize text-foreground">{result.emotion || 'Unknown'}</span> {/* Larger text */}
                   </div>
                   <div className="w-full pt-1">
                     <div className="flex justify-between text-sm mb-1 text-muted-foreground">
                       <span>Confidence</span>
                       <span>{`${(result.confidence * 100).toFixed(1)}%`}</span>
                     </div>
                     <Progress value={result.confidence * 100} indicatorClassName="bg-accent rounded-full" className="w-full h-1.5 rounded-full" /> {/* Slimmer, rounded */}
                   </div>
                </CardContent>
               </Card>
            )}
         </div>
      </CardContent>
       <CardFooter className="text-xs text-muted-foreground text-center p-4 pt-0 border-t border-border/30 mt-2"> {/* Added top border */}
           AI analysis provides an estimate based on {analysisMode === 'webcam' ? 'a single frame' : 'the uploaded image'}. Results may vary.
        </CardFooter>
    </Card>
  );
}
