import React, { useState, useEffect } from 'react';
import { SplashScreen } from '../screens/SplashScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { InterestSelectionScreen } from '../screens/InterestSelectionScreen';
import { StylePreferenceScreen } from '../screens/StylePreferenceScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { onAuthChange, getCurrentUser } from '../services/authService';
import { updatePreferences, getProfile } from '../services/apiClient';

type Screen =
  | 'splash'
  | 'welcome'
  | 'signup'
  | 'login'
  | 'forgot'
  | 'interests'
  | 'styles'
  | 'home';

export function AuthNavigator() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    // Listen to Firebase auth state for sign-out events
    const unsubscribe = onAuthChange(user => {
      if (!user && screen !== 'splash' && screen !== 'welcome' && screen !== 'signup' && screen !== 'login' && screen !== 'forgot') {
        setScreen('welcome');
      }
    });
    return unsubscribe;
  }, [screen]);

  const handleFinishInterests = (interests: string[]) => {
    setSelectedInterests(interests);
    setScreen('styles');
  };

  const handleFinishStyles = async (styles: string[]) => {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem('decox_onboarded', 'true');
    }
    // Persist preferences to Cloud SQL backend
    try {
      await updatePreferences({
        interests: selectedInterests,
        styles,
      });
    } catch (e) {
      // Non-blocking if offline
    }
    setScreen('home');
  };

  // Check if an authenticated user already completed style onboarding
  const routeUserAfterAuth = async () => {
    // 1. Fast path: check local storage first
    if (typeof window !== 'undefined' && window.localStorage?.getItem('decox_onboarded') === 'true') {
      setScreen('home');
      return;
    }

    try {
      const res = await getProfile();
      const user = res?.user;
      const hasCompleted = Boolean(
        user &&
        Array.isArray(user.interests) &&
        user.interests.length > 0 &&
        Array.isArray(user.styles) &&
        user.styles.length > 0
      );
      if (hasCompleted) {
        if (typeof window !== 'undefined') {
          window.localStorage?.setItem('decox_onboarded', 'true');
        }
        setScreen('home');
      } else {
        setScreen('interests');
      }
    } catch {
      // Fallback to home if profile check fails
      setScreen('home');
    }
  };

  if (screen === 'splash') {
    return (
      <SplashScreen
        onFinish={() => {
          const user = getCurrentUser();
          if (user) {
            routeUserAfterAuth();
          } else {
            setScreen('welcome');
          }
        }}
      />
    );
  }

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onContinue={() => setScreen('signup')}
        onLogin={() => setScreen('login')}
        onGoogleSuccess={(hasCompletedOnboarding) => {
          if (hasCompletedOnboarding) {
            setScreen('home');
          } else {
            setScreen('interests');
          }
        }}
      />
    );
  }

  if (screen === 'signup') {
    return (
      <SignUpScreen
        onComplete={() => setScreen('interests')}
        onBack={() => setScreen('welcome')}
      />
    );
  }

  if (screen === 'login') {
    return (
      <LoginScreen
        onLogin={routeUserAfterAuth}
        onBack={() => setScreen('welcome')}
        onForgotPassword={() => setScreen('forgot')}
      />
    );
  }

  if (screen === 'forgot') {
    return (
      <ForgotPasswordScreen
        onBack={() => setScreen('login')}
        onSent={() => setScreen('login')}
      />
    );
  }

  if (screen === 'interests') {
    return <InterestSelectionScreen onNext={handleFinishInterests} />;
  }

  if (screen === 'styles') {
    return (
      <StylePreferenceScreen
        onNext={handleFinishStyles}
        onBack={() => setScreen('interests')}
      />
    );
  }

  // Main 5-tab application
  return <MainTabNavigator onLogout={() => setScreen('welcome')} />;
}
