import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { CreateUploadScreen } from './CreateUploadScreen';
import { EditRequestScreen } from './EditRequestScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { ResultScreen } from './ResultScreen';
import { runConcierge } from '../services/apiClient';
import { useSubscription } from '../context/SubscriptionContext';

interface CreateFlowScreenProps {
  onFinish: () => void;
}

type FlowStep = 'upload' | 'form' | 'processing' | 'result';

/**
 * Convert a local file:// URI to a base64 data URL.
 * Remote URLs (https://) pass through unchanged — backend can fetch those.
 */
async function resolveImageToDataUrl(uri: string): Promise<string> {
  if (!uri) return uri;

  // Already a data URL or remote URL — pass through
  if (uri.startsWith('data:') || uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  // Local file — read as base64
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // Detect extension for MIME type
    const ext = uri.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.warn('Failed to read image as base64, sending URI as-is:', err);
    return uri;
  }
}

export function CreateFlowScreen({ onFinish }: CreateFlowScreenProps) {
  const [step, setStep] = useState<FlowStep>('upload');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [resultData, setResultData] = useState<any>(null);

  const { useGenerationCredit } = useSubscription();

  const handleImageSelected = (uri: string) => {
    setSelectedImage(uri);
    setStep('form');
  };

  const handleFormSubmit = async (formData: {
    roomImage: string;
    prompt: string;
    spaceType: string;
    stylePref: string;
    preferredStore?: string;
  }) => {
    // Check RevenueCat Pro / Quota
    const authorized = useGenerationCredit();
    if (!authorized) {
      // Paywall modal opens automatically
      return;
    }

    setCurrentPrompt(formData.prompt);
    setStep('processing');

    try {
      // Convert local file:// to base64 data URL so backend can read the image
      const imagePayload = await resolveImageToDataUrl(formData.roomImage);

      const response = await runConcierge({
        roomImage: imagePayload,
        prompt: formData.prompt,
        spaceType: formData.spaceType,
        preferredStore: formData.preferredStore,
      });

      setResultData(response);
      setStep('result');
    } catch (e: any) {
      console.error('Concierge execution error:', e);
      Alert.alert(
        'Redesign Error',
        e?.message || 'Could not complete spatial redesign. Please check connection and try again.',
        [
          {
            text: 'Edit Request',
            onPress: () => setStep('form'),
          },
          {
            text: 'Cancel',
            onPress: () => setStep('upload'),
          },
        ]
      );
    }
  };

  if (step === 'upload') {
    return (
      <CreateUploadScreen
        onImageSelected={handleImageSelected}
        onCancel={onFinish}
      />
    );
  }

  if (step === 'form' && selectedImage) {
    return (
      <EditRequestScreen
        imageUri={selectedImage}
        onBack={() => setStep('upload')}
        onSubmit={handleFormSubmit}
      />
    );
  }

  if (step === 'processing') {
    return <ProcessingScreen promptText={currentPrompt} />;
  }

  if (step === 'result' && selectedImage) {
    return (
      <ResultScreen
        originalImage={selectedImage}
        resultData={resultData}
        onDone={onFinish}
        onNewEdit={() => setStep('upload')}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
