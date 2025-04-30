"use client";

import React, { useState, useRef } from 'react';
import { analyzeEmotionFromImage, type AnalyzeEmotionFromImageOutput } from '@/ai/flows/analyze-emotion-from-image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from "@/hooks/use-toast";
import { Upload, Smile, Frown, Angry, Meh, Annoyed, Surprised, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react'; // Added Image icon

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
       return <Surprised className="w-6 h-6 text-yellow-500" />;
    case 'fear':
       return <Annoyed className="w-6 h-6 text-purple-500" />; // Using Annoyed for Fear as lucide lacks a specific 'Fear' icon
    case 'neutral':
    default:
      return <Meh className="w-6 h-6 text-gray-500" />;
  }
};

export default function EmotionDetector() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<EmotionResult>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic image type validation
      if (!file.type.startsWith('image/')) {
        setError('Invalid file type. Please upload an image (JPEG, PNG, GIF, WEBP).');
        setImageFile(null);
        setImagePreview(null);
        setResult(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Reset file input
        }
        return;
      }

      // Size validation (e.g., max 5MB)
      const maxSizeInBytes = 5 * 1024 * 1024;
      if (file.size > maxSizeInBytes) {
          setError('File size exceeds 5MB limit.');
          setImageFile(null);
          setImagePreview(null);
          setResult(null);
          if (fileInputRef.current) {
              fileInputRef.current.value = ''; // Reset file input
          }
          return;
      }

      setImageFile(file);
      setResult(null); // Clear previous results
      setError(null); // Clear previous errors

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
        setImageFile(null);
        setImagePreview(null);
        setResult(null);
    }
  };

  const handleAnalyzeClick = async () => {
    if (!imageFile || !imagePreview) {
       toast({
          title: "No Image Selected",
          description: "Please select an image file first.",
          variant: "destructive",
        });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
        // Ensure imagePreview has the base64 data URI format
        if (!imagePreview.startsWith('data:image/')) {
            throw new Error('Invalid image data format for analysis.');
        }

      const analysisResult = await analyzeEmotionFromImage({ photoDataUri: imagePreview });
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset file input
    }
  };


  return (
    <Card className="w-full shadow-lg rounded-xl overflow-hidden">
      <CardHeader>
        <CardTitle className="text-center text-xl md:text-2xl font-semibold text-primary">Emotion Detection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col items-center space-y-4">
          <div
            className={`relative w-full aspect-video bg-secondary rounded-lg flex items-center justify-center border-2 border-dashed ${error ? 'border-destructive' : 'border-border'} overflow-hidden cursor-pointer hover:border-primary transition-colors`}
            onClick={triggerFileInput}
            role="button"
            aria-label="Upload image area"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Uploaded preview" className="object-contain max-h-full max-w-full" />
            ) : (
              <div className="text-center text-muted-foreground p-4">
                 <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                <p>Click or drag & drop to upload an image</p>
                <p className="text-xs">(Max 5MB: JPEG, PNG, GIF, WEBP)</p>
              </div>
            )}
          </div>
          <Input
            ref={fileInputRef}
            id="image-upload"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className="hidden" // Hide the default input, use the area above
            aria-label="Image file input"
          />
           {imagePreview && (
            <Button variant="outline" size="sm" onClick={handleClear} className="mt-2">
              Clear Image
            </Button>
           )}
        </div>


        <Button
          onClick={handleAnalyzeClick}
          disabled={!imageFile || isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          aria-live="polite"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Analyze Emotion
            </>
          )}
        </Button>

        {isLoading && (
            <Progress value={undefined} className="w-full h-2 animate-pulse" /> // Indeterminate progress
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
                 <Progress value={result.confidence * 100} className="w-full h-2 [&>div]:bg-accent" />
               </div>
            </CardContent>
           </Card>
        )}
      </CardContent>
       <CardFooter className="text-xs text-muted-foreground text-center p-4 pt-0">
           AI analysis provides an estimate. Results may vary based on image quality and facial expression clarity.
        </CardFooter>
    </Card>
  );
}
