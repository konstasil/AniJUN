"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "./supabase/client";
import { ADMIN_IDS } from "./admin";

type SimulatedProfile = {
  id: string;
  username: string;
};

type SimulationContextType = {
  simulatedUserId: string | null;
  simulatedProfile: SimulatedProfile | null;
  setSimulatedUserId: (id: string | null) => void;
  getEffectiveUserId: (realUserId: string) => string;
  isSimulating: boolean;
};

const SimulationContext = createContext<SimulationContextType>({
  simulatedUserId: null,
  simulatedProfile: null,
  setSimulatedUserId: () => {},
  getEffectiveUserId: (id) => id,
  isSimulating: false,
});

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [simulatedUserId, setSimulatedUserIdState] = useState<string | null>(null);
  const [simulatedProfile, setSimulatedProfile] = useState<SimulatedProfile | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // При изменении simulatedUserId записываем/удаляем запись в admin_simulations
  const setSimulatedUserId = useCallback((userId: string | null) => {
    setSimulatedUserIdState(userId);
  }, []);

  // Синхронизируем с БД при монтировании
  useEffect(() => {
    async function restore() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !ADMIN_IDS.includes(session.user.id)) {
        localStorage.removeItem("simulated_user_id");
        setSimulatedUserIdState(null);
        return;
      }
      const stored = localStorage.getItem("simulated_user_id");
      if (stored) {
        setSimulatedUserIdState(stored);
      }
    }
    restore();
  }, [supabase]);

  // При изменении simulatedUserId синхронизируем с БД
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!simulatedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled && session?.user) {
          await supabase
            .from("admin_simulations")
            .delete()
            .eq("admin_id", session.user.id);
        }
        if (!cancelled) {
          setSimulatedProfile(null);
          localStorage.removeItem("simulated_user_id");
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !ADMIN_IDS.includes(session.user.id)) {
        if (!cancelled) setSimulatedUserIdState(null);
        return;
      }

      if (cancelled) return;

      localStorage.setItem("simulated_user_id", simulatedUserId);

      // Создаём/обновляем запись симуляции в БД
      await supabase
        .from("admin_simulations")
        .upsert({ admin_id: session.user.id, simulated_user_id: simulatedUserId });

      if (cancelled) return;

      // Загружаем профиль
      const { data } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", simulatedUserId)
        .single();
      if (!cancelled && data) setSimulatedProfile(data);
    }

    sync();
    return () => { cancelled = true; };
  }, [simulatedUserId, supabase]);

  // Логируем изменения симуляции
  useEffect(() => {
    if (simulatedUserId && simulatedProfile) {
      console.log(`[Simulation] Active as: ${simulatedProfile.username} (${simulatedUserId})`);
    } else if (simulatedUserId && !simulatedProfile) {
      console.log(`[Simulation] Loading profile for: ${simulatedUserId}`);
    } else {
      console.log("[Simulation] Inactive");
    }
  }, [simulatedUserId, simulatedProfile]);

  const getEffectiveUserId = useCallback(
    (realUserId: string): string => simulatedUserId || realUserId,
    [simulatedUserId]
  );

  return (
    <SimulationContext.Provider
      value={{
        simulatedUserId,
        simulatedProfile,
        setSimulatedUserId,
        getEffectiveUserId,
        isSimulating: !!simulatedUserId,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulatedUser() {
  return useContext(SimulationContext);
}