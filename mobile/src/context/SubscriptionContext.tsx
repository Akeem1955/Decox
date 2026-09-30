import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  initRevenueCat,
  checkProStatus,
  purchaseSubscription,
  restorePurchases,
  getSubscriptionOfferings,
  SubscriptionPackage,
} from '../services/revenueCatService';
import { getCurrentUser } from '../services/authService';

interface SubscriptionContextType {
  isPro: boolean;
  freeGenerationsLeft: number;
  activePlan?: 'monthly' | 'annual';
  paywallVisible: boolean;
  paywallReason?: string;
  packages: SubscriptionPackage[];
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
  subscribe: (plan: 'monthly' | 'annual', rawPackage?: any) => Promise<boolean>;
  restore: () => Promise<boolean>;
  useGenerationCredit: () => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [activePlan, setActivePlan] = useState<'monthly' | 'annual' | undefined>(undefined);
  const [freeGenerationsLeft, setFreeGenerationsLeft] = useState(3);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>(undefined);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);

  useEffect(() => {
    const user = getCurrentUser();
    initRevenueCat(user?.uid)
      .then(() => checkProStatus())
      .then(info => {
        setIsPro(info.isPro);
        if (info.activePlan) setActivePlan(info.activePlan);
      })
      .catch(() => {});

    getSubscriptionOfferings()
      .then(pkgs => setPackages(pkgs))
      .catch(() => {});
  }, []);

  const openPaywall = (reason?: string) => {
    setPaywallReason(reason);
    setPaywallVisible(true);
  };

  const closePaywall = () => {
    setPaywallVisible(false);
    setPaywallReason(undefined);
  };

  const subscribe = async (plan: 'monthly' | 'annual', rawPackage?: any): Promise<boolean> => {
    try {
      const result = await purchaseSubscription(plan, rawPackage);
      if (result.isPro) {
        setIsPro(true);
        setActivePlan(plan);
        closePaywall();
        return true;
      }
      return false;
    } catch (e: any) {
      console.warn('Subscription error:', e);
      return false;
    }
  };

  const restore = async (): Promise<boolean> => {
    try {
      const result = await restorePurchases();
      if (result.isPro) {
        setIsPro(true);
        if (result.activePlan) setActivePlan(result.activePlan);
        closePaywall();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  /**
   * Consumes 1 credit if free user. Returns true if authorized, false if blocked.
   */
  const useGenerationCredit = (): boolean => {
    if (isPro) {
      return true; // Pro users enjoy unlimited generations
    }

    if (freeGenerationsLeft > 0) {
      setFreeGenerationsLeft(prev => prev - 1);
      return true;
    }

    // Quota exhausted -> Trigger Paywall
    openPaywall('You have used all 3 free room redesigns. Upgrade to Decox Pro for unlimited generations.');
    return false;
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        freeGenerationsLeft,
        activePlan,
        paywallVisible,
        paywallReason,
        packages,
        openPaywall,
        closePaywall,
        subscribe,
        restore,
        useGenerationCredit,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
