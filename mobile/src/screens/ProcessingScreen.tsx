import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { FlowerLoader } from '../components/FlowerLoader';

const PIPELINE_STEPS = [
  {
    title: '1. Multimodal Intent & Geometry Analysis',
    desc: 'Gemini 3.8 Flash extracting room perspective, lighting, and bounds...',
    icon: '📐',
  },
  {
    title: '2. Parallel Marketplace Sourcing',
    desc: 'Querying live Nigerian retail inventories (Jumia, Konga, etc.)...',
    icon: '🔍',
  },
  {
    title: '3. Price & Stock Verification',
    desc: 'Validating real checkout links & extracting authentic Naira prices...',
    icon: '🏷️',
  },
  {
    title: '4. Gemini 3.1 Flash Image Compositing',
    desc: 'Staging authentic items into your room geometry with drop shadows...',
    icon: '🎨',
  },
];

interface ProcessingScreenProps {
  promptText: string;
}

export function ProcessingScreen({ promptText }: ProcessingScreenProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStep(1), 3500);
    const timer2 = setTimeout(() => setCurrentStep(2), 7000);
    const timer3 = setTimeout(() => setCurrentStep(3), 11000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const pad = Math.max(width * 0.06, 20);
  const maxW = Math.min(width, 500);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.inner, { paddingHorizontal: pad, maxWidth: maxW }]}>
        <View style={styles.spinnerBlock}>
          <FlowerLoader size={72} />
          <Text style={[styles.title, { color: colors.text }]}>
            Executing Spatial Redesign
          </Text>
          <Text style={[styles.promptSummary, { color: colors.textSecondary }]} numberOfLines={2}>
            "{promptText}"
          </Text>
        </View>

        {/* 4 Pipeline Milestones */}
        <View
          style={[
            styles.pipelineCard,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC',
              borderColor: colors.border,
            },
          ]}
        >
          {PIPELINE_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <View key={`step-${idx}`} style={styles.stepRow}>
                <View style={styles.stepIconCol}>
                  <View
                    style={[
                      styles.stepCircle,
                      isCompleted && styles.stepCircleDone,
                      isCurrent && styles.stepCircleActive,
                    ]}
                  >
                    <Text style={{ fontSize: 13 }}>
                      {isCompleted ? '✓' : step.icon}
                    </Text>
                  </View>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: isCompleted ? Colors.accent : colors.border },
                      ]}
                    />
                  )}
                </View>

                <View style={styles.stepTextCol}>
                  <Text
                    style={[
                      styles.stepTitle,
                      {
                        color: isCurrent
                          ? Colors.accent
                          : isCompleted
                          ? colors.text
                          : colors.textSecondary,
                        fontWeight: isCurrent ? '800' : '600',
                      },
                    ]}
                  >
                    {step.title}
                  </Text>
                  <Text
                    style={[
                      styles.stepDesc,
                      { color: isCurrent ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {step.desc}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
          🔒 <Text style={{ fontWeight: '700' }}>Real or Fail Guarantee:</Text> No fictional or hallucinated furniture is generated. Only real instore purchasable products are staged.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  inner: { width: '100%', alignSelf: 'center', gap: 24 },
  spinnerBlock: { alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  promptSummary: { fontSize: 13, textAlign: 'center', fontStyle: 'italic', maxWidth: 360 },
  pipelineCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  stepRow: { flexDirection: 'row', gap: 14 },
  stepIconCol: { alignItems: 'center', width: 28 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  stepCircleDone: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  stepCircleActive: {
    backgroundColor: 'rgba(255, 107, 0, 0.15)',
    borderColor: Colors.accent,
  },
  stepLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  stepTextCol: { flex: 1, gap: 2, paddingBottom: 14 },
  stepTitle: { fontSize: 13 },
  stepDesc: { fontSize: 11, lineHeight: 15 },
  guaranteeText: { fontSize: 12, textAlign: 'center', lineHeight: 17, paddingHorizontal: 12 },
});
