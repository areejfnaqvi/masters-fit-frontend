import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useFocusEffect } from "@react-navigation/native";
import {
  fetchActiveWorkout,
  createExerciseLog,
  markPlanDayAsComplete,
  skipExercise,
  skipWorkoutBlock,
} from "@/lib/workouts";
import { getCurrentUser } from "@/lib/auth";
import {
  calculateWorkoutDuration,
  formatEquipment,
  getCurrentDate,
  formatDateAsString,
} from "@/utils";
import ExerciseLink from "@/components/ExerciseLink";
import SetTracker, { ExerciseSet } from "@/components/SetTracker";
import { colors } from "@/lib/theme";
import {
  WorkoutBlockWithExercises,
  WorkoutBlockWithExercise,
  PlanDayWithBlocks,
  CreateExerciseLogParams,
  getBlockTypeDisplayName,
} from "@/types/api/workout.types";
import { Exercise } from "@/types/api/exercise.types";
import { useWorkout } from "@/contexts/WorkoutContext";
import { useAppDataContext } from "@/contexts/AppDataContext";
import { WorkoutSkeleton } from "../../components/skeletons/SkeletonScreens";

// Local types for this component
interface ExerciseProgress {
  setsCompleted: number;
  repsCompleted: number;
  roundsCompleted: number;
  weightUsed: number;
  sets: ExerciseSet[];
  duration: number;
  restTime: number;
  notes: string;
}

// Utility functions
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function WorkoutScreen() {
  // Get workout context for tab disabling
  const { setWorkoutInProgress, isWorkoutInProgress } = useWorkout();

  // Get data refresh functions
  const {
    refresh: { refreshDashboard },
  } = useAppDataContext();

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<PlanDayWithBlocks | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isWorkoutStarted, setIsWorkoutStarted] = useState(false);
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Timer state
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [exerciseTimer, setExerciseTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Exercise progress state
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgress[]>(
    []
  );

  // Skip state
  const [skippedExercises, setSkippedExercises] = useState<number[]>([]);
  const [skippedBlocks, setSkippedBlocks] = useState<number[]>([]);

  // Modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showRestCompleteModal, setShowRestCompleteModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [isCompletingExercise, setIsCompletingExercise] = useState(false);
  const [isSkippingExercise, setIsSkippingExercise] = useState(false);

  // Rest timer state
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [isRestTimerPaused, setIsRestTimerPaused] = useState(false);
  const [restTimerCountdown, setRestTimerCountdown] = useState(0);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const scrollViewRef = useRef<ScrollView>(null);

  // Get flattened exercises from blocks
  const getFlattenedExercises = (): WorkoutBlockWithExercise[] => {
    if (!workout?.blocks) return [];
    return workout.blocks.flatMap((block) => block.exercises);
  };

  const exercises = getFlattenedExercises();
  const currentExercise = exercises[currentExerciseIndex];
  const currentProgress = exerciseProgress[currentExerciseIndex];

  // Calculate overall workout progress (0 - 100) including skipped exercises
  const completedAndSkippedCount =
    currentExerciseIndex + skippedExercises.length;
  const progressPercent =
    exercises.length > 0
      ? (completedAndSkippedCount / exercises.length) * 100
      : 0;

  // Timer management
  useEffect(() => {
    if (isWorkoutStarted && !isPaused && !isWorkoutCompleted) {
      timerRef.current = setInterval(() => {
        setWorkoutTimer((prev) => prev + 1);
        setExerciseTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isWorkoutStarted, isPaused, isWorkoutCompleted]);

  // Rest timer management
  useEffect(() => {
    if (isRestTimerActive && !isRestTimerPaused && restTimerCountdown > 0) {
      restTimerRef.current = setInterval(() => {
        setRestTimerCountdown((prev) => {
          if (prev <= 1) {
            // Timer finished
            setIsRestTimerActive(false);
            setIsRestTimerPaused(false);
            if (restTimerRef.current) {
              clearInterval(restTimerRef.current);
            }
            // Show rest completion modal when rest timer finishes
            setShowRestCompleteModal(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    }

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, [isRestTimerActive, isRestTimerPaused, restTimerCountdown]);

  // Sync context with workout state
  useEffect(() => {
    console.log(
      "🔄 Syncing context - isWorkoutStarted:",
      isWorkoutStarted,
      "isWorkoutCompleted:",
      isWorkoutCompleted
    );

    if (isWorkoutCompleted) {
      setWorkoutInProgress(false);
    } else if (isWorkoutStarted) {
      setWorkoutInProgress(true);
    } else {
      setWorkoutInProgress(false);
    }
  }, [isWorkoutStarted, isWorkoutCompleted, setWorkoutInProgress]);

  // Handle workout abandonment - reset workout state when context says no workout in progress
  // but local state thinks workout is started
  useEffect(() => {
    if (!isWorkoutInProgress && isWorkoutStarted && !isWorkoutCompleted) {
      console.log("🚪 Workout abandoned - resetting workout state");
      setIsWorkoutStarted(false);
      setIsPaused(false);
      setWorkoutTimer(0);
      setExerciseTimer(0);
      setCurrentExerciseIndex(0);
      setIsRestTimerActive(false);
      setIsRestTimerPaused(false);
      setRestTimerCountdown(0);
      // Clear any active timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    }
  }, [isWorkoutInProgress, isWorkoutStarted, isWorkoutCompleted]);

  // Cleanup workout context on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 Component unmounting, clearing workout context");
      setWorkoutInProgress(false);
    };
  }, [setWorkoutInProgress]);

  // Load workout data
  const loadWorkout = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        setLoading(true);
      }
      setError(null);

      const response = await fetchActiveWorkout(forceRefresh);

      if (!response?.workout?.planDays?.length) {
        setWorkout(null);
        return;
      }

      // Find today's workout using string comparison to avoid timezone issues
      const today = getCurrentDate(); // Use the same function as other parts of the app
      console.log("🗓️ Looking for workout for today:", today);
      console.log(
        "📅 Available plan days:",
        response.workout.planDays.map((day: any) => ({
          date: day.date,
          normalizedDate: formatDateAsString(day.date),
        }))
      );

      const todaysWorkout = response.workout.planDays.find((day: any) => {
        // Use the formatDateAsString function to normalize dates consistently
        const normalizedDayDate = formatDateAsString(day.date);
        return normalizedDayDate === today;
      });

      console.log("🎯 Found today's workout:", todaysWorkout ? "YES" : "NO");

      if (!todaysWorkout) {
        setWorkout(null);
        return;
      }

      // If the plan day is already marked as complete, show the completed screen.
      if (todaysWorkout.isComplete) {
        setWorkout(todaysWorkout);
        setIsWorkoutCompleted(true);
        setWorkoutInProgress(false); // Make sure context knows workout is complete
        return;
      }

      setWorkout(todaysWorkout);

      // Check if there's an existing workout session in progress
      // (You might need to add logic here to detect if a workout was previously started)

      // Initialize exercise progress
      const flatExercises = todaysWorkout.blocks.flatMap(
        (block: WorkoutBlockWithExercises) => block.exercises
      );
      const initialProgress: ExerciseProgress[] = flatExercises.map(
        (exercise: WorkoutBlockWithExercise) => ({
          setsCompleted: 0,
          repsCompleted: 0,
          roundsCompleted: 0,
          weightUsed: exercise.weight || 0,
          sets: [],
          duration: exercise.duration || 0,
          restTime: exercise.restTime || 0,
          notes: "",
        })
      );
      setExerciseProgress(initialProgress);
    } catch (err) {
      console.error("Error loading workout:", err);
      setError("Failed to load workout. Please try again.");
    } finally {
      setLoading(false);
      if (forceRefresh) {
        setRefreshing(false);
      }
    }
  };

  // Pull to refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkout(true);
  }, []);

  // Load workout on mount and when tab is focused
  useEffect(() => {
    loadWorkout();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Don't force refresh on focus, rely on cache
      loadWorkout(false);
    }, [])
  );

  // Update exercise progress
  const updateProgress = (field: keyof ExerciseProgress, value: any) => {
    setExerciseProgress((prev) => {
      const updated = [...prev];
      updated[currentExerciseIndex] = {
        ...updated[currentExerciseIndex],
        [field]: value,
      };
      return updated;
    });
  };

  // Start workout
  const startWorkout = () => {
    setIsWorkoutStarted(true);
    setWorkoutTimer(0);
    setExerciseTimer(0);
    console.log("🏃 Starting workout, setting context to true");
    setWorkoutInProgress(true); // Notify context that workout started
  };

  // Toggle pause
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Start rest timer
  const startRestTimer = () => {
    const restTime = currentExercise?.restTime || 0;
    if (restTime > 0) {
      setRestTimerCountdown(restTime);
      setIsRestTimerActive(true);
      setIsRestTimerPaused(false);
    }
  };

  // Pause/Resume rest timer
  const toggleRestTimerPause = () => {
    setIsRestTimerPaused(!isRestTimerPaused);
  };

  // Reset rest timer
  const resetRestTimer = () => {
    const restTime = currentExercise?.restTime || 0;
    setRestTimerCountdown(restTime);
    setIsRestTimerPaused(false);
  };

  // Cancel rest timer
  const cancelRestTimer = () => {
    setIsRestTimerActive(false);
    setIsRestTimerPaused(false);
    setRestTimerCountdown(0);
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
    }
  };

  // Complete current exercise
  const completeExercise = async () => {
    if (!currentExercise || !currentProgress) return;

    setIsCompletingExercise(true);

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      // Create exercise log - use timer for duration
      if (!currentProgress.sets || currentProgress.sets.length === 0) {
        Alert.alert(
          "No Sets Logged",
          "Please click 'Add Set' and log your weights and reps before completing this exercise.",
          [{ text: "OK" }]
        );
        return;
      }

      await createExerciseLog({
        planDayExerciseId: currentExercise.id,
        sets: currentProgress.sets,
        durationCompleted: currentProgress.duration,
        isComplete: true,
        timeTaken: exerciseTimer, // This logs the actual time spent on exercise
        notes: currentProgress.notes,
      });

      // Move to next exercise or complete workout
      if (currentExerciseIndex < exercises.length - 1) {
        setCurrentExerciseIndex((prev) => prev + 1);
        setExerciseTimer(0);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        // All exercises completed, so mark the plan day as complete
        if (workout?.id) {
          await markPlanDayAsComplete(workout.id);
          // Refresh dashboard data with current date range to ensure today's data is included
          // Include both past workouts and upcoming planned workouts for weekly progress
          const today = new Date();
          const startDate = new Date(today);
          startDate.setDate(today.getDate() - 30); // 30 days back for historical data
          const endDate = new Date(today);
          endDate.setDate(today.getDate() + 7); // 7 days forward for planned workouts

          await refreshDashboard({
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
          });
        }

        setCurrentExerciseIndex(exercises.length); // This will make progress show 100%
        setIsWorkoutCompleted(true);
        setWorkoutInProgress(false); // Notify context that workout ended
        Alert.alert(
          "Workout Complete!",
          "Congratulations! You've completed today's workout.",
          [{ text: "OK" }]
        );
      }

      setShowCompleteModal(false);
    } catch (err) {
      console.error("Error completing exercise:", err);
      Alert.alert("Error", "Failed to complete exercise. Please try again.");
    } finally {
      setIsCompletingExercise(false);
    }
  };

  // Skip current exercise
  const skipCurrentExercise = async () => {
    if (!currentExercise || !workout) return;

    setIsSkippingExercise(true);

    try {
      // Call skip API
      await skipExercise(workout.workoutId, currentExercise.id);

      // Update local state
      setSkippedExercises((prev) => [...prev, currentExercise.id]);

      // Mark progress as skipped
      setExerciseProgress((prev) => {
        const updated = [...prev];
        updated[currentExerciseIndex] = {
          ...updated[currentExerciseIndex],
          isSkipped: true,
        };
        return updated;
      });

      // Move to next exercise or complete workout
      if (currentExerciseIndex < exercises.length - 1) {
        setCurrentExerciseIndex((prev) => prev + 1);
        setExerciseTimer(0);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        // Check if all exercises are completed or skipped
        const allProcessed = exercises.every(
          (ex, index) =>
            index < currentExerciseIndex ||
            skippedExercises.includes(ex.id) ||
            index === currentExerciseIndex
        );

        if (allProcessed && workout?.id) {
          await markPlanDayAsComplete(workout.id);
          setCurrentExerciseIndex(exercises.length);
          setIsWorkoutCompleted(true);
          setWorkoutInProgress(false);
          Alert.alert("Workout Complete!", "You've finished today's workout.", [
            { text: "OK" },
          ]);
        }
      }

      setShowSkipModal(false);
    } catch (err) {
      console.error("Error skipping exercise:", err);
      Alert.alert("Error", "Failed to skip exercise. Please try again.");
    } finally {
      setIsSkippingExercise(false);
    }
  };

  // Get current block for the current exercise
  const getCurrentBlock = (): WorkoutBlockWithExercises | null => {
    if (!workout?.blocks || !currentExercise) return null;

    for (const block of workout.blocks) {
      if (block.exercises.some((ex) => ex.id === currentExercise.id)) {
        return block;
      }
    }
    return null;
  };

  const currentBlock = getCurrentBlock();

  // Render loading state
  if (loading) {
    return <WorkoutSkeleton />;
  }

  // Render error state
  if (error) {
    return (
      <View className="flex-1 bg-background justify-center items-center px-6">
        <Ionicons
          name="alert-circle-outline"
          size={64}
          color={colors.text.secondary}
        />
        <Text className="text-lg font-bold text-text-primary text-center mt-4 mb-2">
          Error Loading Workout
        </Text>
        <Text className="text-text-muted text-center mb-6 leading-6">
          {error}
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-xl py-3 px-6"
          onPress={() => loadWorkout(true)}
        >
          <Text className="text-secondary font-semibold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render no workout state
  if (!workout) {
    return (
      <View className="flex-1 bg-background justify-center items-center px-6">
        <Ionicons name="fitness-outline" size={64} color={colors.text.muted} />
        <Text className="text-lg font-bold text-text-primary text-center mt-4 mb-2">
          No Workout Today
        </Text>
        <Text className="text-text-muted text-center mb-6 leading-6">
          You don't have a workout scheduled for today. Check back tomorrow or
          visit the Calendar tab to see your workout plan.
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-xl py-3 px-6"
          onPress={() => loadWorkout()}
        >
          <Text className="text-secondary font-semibold">Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render workout completed state
  if (isWorkoutCompleted) {
    return (
      <View className="flex-1 bg-background justify-center items-center px-6">
        <Ionicons
          name="checkmark-circle"
          size={80}
          color={colors.brand.primary}
        />
        <Text className="text-2xl font-bold text-text-primary text-center mt-6 mb-4">
          Workout Complete!
        </Text>
        <Text className="text-text-muted text-center mb-4 leading-6">
          Amazing work! You completed {currentExerciseIndex} exercises
          {skippedExercises.length > 0 &&
            ` (${skippedExercises.length} skipped)`}{" "}
          in {formatTime(workoutTimer)}.
        </Text>
        <Text className="text-text-muted text-center mb-8 leading-6">
          Check back tomorrow for your next workout.
        </Text>
      </View>
    );
  }

  // Main workout interface
  return (
    <View className="flex-1 bg-background">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        {/* Hero Exercise Media */}
        {currentExercise ? (
          <ExerciseLink
            link={currentExercise.exercise.link}
            exerciseName={currentExercise.exercise.name}
            variant="hero"
          />
        ) : null}

        <View className="px-6 pt-6">
          {/* Workout Header */}
          {/* Pre-computed progressPercent used for the progress bar */}
          <View className="mb-6">
            <View className="w-full h-2 mb-4 bg-neutral-light-2 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${progressPercent.toFixed(0)}%` } as any}
              />
            </View>
            <View className="flex-row items-start mb-2">
              <Text className="text-2xl font-bold text-text-primary flex-1 mr-3">
                {workout.name}
              </Text>
              {isWorkoutStarted && (
                <View className="bg-background rounded-xl px-3 py-1 min-w-[80px]">
                  <Text className="text-lg font-bold text-text-primary text-center">
                    {formatTime(workoutTimer)}
                  </Text>
                </View>
              )}
            </View>
            {workout.instructions ? (
              <Text className="text-base text-text-secondary leading-6">
                {workout.instructions}
              </Text>
            ) : null}
          </View>

          {/* Current Block Info */}
          {currentBlock ? (
            <View className="bg-brand-light-1 rounded-2xl p-4 mb-6">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center justify-between px-2 mb-1">
                    <Text className="text-sm font-bold text-text-primary mb-1">
                      {currentBlock.blockName ||
                        getBlockTypeDisplayName(currentBlock.blockType)}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <View className="items-end">
                        {currentBlock.rounds && (
                          <Text className="text-sm font-semibold text-text-primary">
                            {currentBlock.rounds === 1
                              ? "1 Round"
                              : `${currentBlock.rounds} Rounds`}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  {currentBlock.instructions ? (
                    <Text className="text-sm text-text-secondary px-2 leading-5">
                      {currentBlock.instructions}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* Current Exercise */}
          {currentExercise ? (
            <View className="bg-card rounded-2xl mb-6 p-6 border shadow-sm font-bold border-neutral-light-2">
              <Text className="text-xl font-bold mb-4 text-text-primary">
                {currentExercise.exercise.name}
              </Text>

              <Text className="text-sm text-text-primary leading-6 mb-3">
                {currentExercise.exercise.description}
              </Text>

              {/* Equipment */}
              {currentExercise.exercise.equipment ? (
                <View className="flex-row justify-start items-center">
                  <View className="flex-col items-start justify-center mb-2">
                    <View className="flex-row items-center mb-2">
                      <Ionicons
                        name="fitness-outline"
                        size={16}
                        color={colors.text.muted}
                      />
                      <Text className="text-sm font-semibold text-text-muted mx-2">
                        Equipment
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-center flex-wrap">
                      {currentExercise.exercise.equipment
                        .split(",")
                        .map((equipment, index) => (
                          <View
                            key={index}
                            className=" bg-brand-primary rounded-full px-3 py-1 mr-2"
                          >
                            <Text className="text-xs text-text-primary font-semibold">
                              {formatEquipment(equipment.trim())}
                            </Text>
                          </View>
                        ))}
                    </View>
                  </View>
                </View>
              ) : null}

              {isWorkoutStarted && currentProgress ? (
                <View className="space-y-4">
                  {/* Rounds - Show if block has multiple rounds */}
                  {currentBlock &&
                  currentBlock.rounds &&
                  currentBlock.rounds > 1 ? (
                    <View className="rounded-2xl p-4">
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-sm font-semibold text-text-primary">
                          Rounds
                        </Text>
                        <Text className="text-xs text-text-muted">
                          Target: {currentBlock.rounds} Rounds
                        </Text>
                      </View>
                      <View className="flex-row justify-center gap-2">
                        {Array.from({ length: currentBlock.rounds }, (_, i) => {
                          const isCompleted =
                            i < (currentProgress?.roundsCompleted || 0);
                          return (
                            <TouchableOpacity
                              key={i}
                              className={`w-9 h-9 rounded-full items-center justify-center border-2 ${
                                isCompleted
                                  ? "border-primary bg-primary"
                                  : "border-neutral-medium-1 bg-background"
                              }`}
                              onPress={() =>
                                updateProgress("roundsCompleted", i + 1)
                              }
                            >
                              {isCompleted ? (
                                <Ionicons
                                  name="checkmark"
                                  size={14}
                                  color={colors.text.secondary}
                                />
                              ) : (
                                <Text className="text-xs font-semibold text-text-muted">
                                  {i + 1}
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {/* Set Tracker Component */}
                  <View className="rounded-2xl p-4">
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-sm font-semibold text-text-primary">
                        Exercise Sets
                      </Text>
                    </View>
                    <SetTracker
                      targetSets={currentExercise.sets || 3}
                      targetReps={currentExercise.reps || 10}
                      targetWeight={currentExercise.weight || 0}
                      targetRounds={currentBlock?.rounds || 1}
                      sets={currentProgress.sets}
                      onSetsChange={(sets) => updateProgress("sets", sets)}
                      blockType={currentBlock?.blockType}
                    />
                  </View>

                  {/* Notes - Compact with quick chips */}
                  <View className="rounded-2xl p-4">
                    <Text className="text-sm font-semibold text-text-primary mb-3">
                      Notes
                    </Text>
                    <TextInput
                      className="bg-background border border-neutral-light-2 rounded-xl p-3 text-text-primary text-sm"
                      placeholder="Add a note... (Optional)"
                      placeholderTextColor={colors.text.muted}
                      value={currentProgress.notes}
                      onChangeText={(text) => updateProgress("notes", text)}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  {/* Rest Timer - Only show if exercise has rest time */}
                  {currentExercise.restTime && currentExercise.restTime > 0 ? (
                    <View className="rounded-2xl p-4 mt-2">
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-sm font-semibold text-text-primary">
                          Rest Timer
                        </Text>
                        <Text className="text-xs font-semibold text-text-muted">
                          Target: {currentExercise.restTime}s
                        </Text>
                      </View>

                      {isRestTimerActive ? (
                        // Active countdown display with control buttons
                        <View className="items-center space-y-3">
                          <View className="bg-background rounded-2xl px-4 py-3 min-w-[80px] items-center">
                            <Text
                              className={`text-lg font-bold text-center ${isRestTimerPaused ? "text-orange-500" : "text-text-primary"}`}
                            >
                              {formatTime(restTimerCountdown)}
                            </Text>
                            {isRestTimerPaused && (
                              <Text className="text-xs text-orange-500 mt-1">
                                PAUSED
                              </Text>
                            )}
                          </View>

                          {/* Rest Timer Control Buttons */}
                          <View className="flex-row gap-2">
                            <TouchableOpacity
                              className="bg-neutral-light-2 rounded-xl py-2 px-3 flex-row items-center justify-center"
                              onPress={toggleRestTimerPause}
                            >
                              <Ionicons
                                name={isRestTimerPaused ? "play" : "pause"}
                                size={14}
                                color={colors.text.primary}
                              />
                              <Text className="text-text-primary text-xs font-semibold ml-1">
                                {isRestTimerPaused ? "Resume" : "Pause"}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              className="bg-neutral-light-2 rounded-xl py-2 px-3 flex-row items-center justify-center"
                              onPress={resetRestTimer}
                            >
                              <Ionicons
                                name="refresh"
                                size={14}
                                color={colors.text.primary}
                              />
                              <Text className="text-text-primary text-xs font-semibold ml-1">
                                Reset
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              className="bg-red-100 rounded-xl py-2 px-3 flex-row items-center justify-center"
                              onPress={cancelRestTimer}
                            >
                              <Ionicons
                                name="close"
                                size={14}
                                color="#ef4444"
                              />
                              <Text className="text-red-500 text-xs font-semibold ml-1">
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View className="items-center">
                          <TouchableOpacity
                            className="bg-primary rounded-2xl py-2 px-6 flex-row items-center justify-center"
                            onPress={startRestTimer}
                          >
                            <Ionicons
                              name="timer-outline"
                              size={18}
                              color={colors.text.secondary}
                            />
                            <Text className="text-secondary text-sm ml-2">
                              Start {currentExercise.restTime}s Rest
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Workout Overview */}
          <View className="bg-card rounded-2xl p-6 shadow-sm border border-neutral-light-2">
            <Text className="text-lg font-bold text-text-primary mb-4">
              Today's Workout Plan
            </Text>

            {workout.blocks.map((block, blockIndex) => (
              <View key={block.id} className="mb-4 last:mb-0">
                <View className="rounded-xl p-3 mb-2">
                  <Text className="text-sm font-bold text-text-primary">
                    {block.blockName ||
                      getBlockTypeDisplayName(block.blockType)}
                  </Text>
                  {block.instructions ? (
                    <Text className="text-xs text-text-muted mt-1">
                      {block.instructions}
                    </Text>
                  ) : null}
                </View>

                {block.exercises.map((exercise, exerciseIndex) => {
                  const globalIndex = exercises.findIndex(
                    (ex) => ex.id === exercise.id
                  );
                  const isCompleted = globalIndex < currentExerciseIndex;
                  const isCurrent = globalIndex === currentExerciseIndex;
                  const isSkipped = skippedExercises.includes(exercise.id);

                  return (
                    <View
                      key={exercise.id}
                      className={`flex-row items-center p-3 rounded-xl mb-2 ${
                        isCurrent
                          ? "bg-brand-light-1 border border-brand-light-1"
                          : isCompleted || isSkipped
                            ? "bg-brand-light-1 border border-brand-light-1"
                            : "bg-background border border-neutral-light-2"
                      }`}
                    >
                      <View
                        className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                          isCompleted
                            ? "bg-neutral-dark-1"
                            : "bg-brand-medium-2"
                        }`}
                      >
                        {isSkipped ? (
                          <Ionicons
                            name="play-skip-forward-outline"
                            size={16}
                            color="white"
                          />
                        ) : isCompleted ? (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={colors.neutral.light[2]}
                          />
                        ) : isCurrent ? (
                          <Ionicons
                            name="play-outline"
                            size={12}
                            color={colors.neutral.dark[1]}
                          />
                        ) : (
                          <Text className="text-xs font-bold text-neutral-dark-1">
                            {globalIndex + 1}
                          </Text>
                        )}
                      </View>

                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-text-primary">
                          {exercise.exercise.name}
                        </Text>
                        <View className="flex-row flex-wrap mt-1">
                          {exercise.sets ? (
                            <Text className="text-xs text-text-muted mr-3">
                              {exercise.sets} sets
                            </Text>
                          ) : null}
                          {exercise.reps ? (
                            <Text className="text-xs text-text-muted mr-3">
                              {exercise.reps} reps
                            </Text>
                          ) : null}
                          {exercise.weight ? (
                            <Text className="text-xs text-text-muted mr-3">
                              {exercise.weight} lbs
                            </Text>
                          ) : null}
                          {exercise.duration ? (
                            <Text className="text-xs text-text-muted">
                              {exercise.duration}s
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="bg-card p-6">
        {!isWorkoutStarted ? (
          <TouchableOpacity
            className="bg-primary rounded-2xl py-4 flex-row items-center justify-center"
            onPress={startWorkout}
          >
            <Ionicons name="play" size={20} color={colors.text.secondary} />
            <Text className="text-secondary font-bold text-lg ml-2">
              Start Workout
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="bg-primary rounded-2xl py-4 flex-1 flex-row items-center justify-center"
              onPress={() => setShowSkipModal(true)}
            >
              <Ionicons
                name="play-skip-forward-outline"
                size={20}
                color={colors.text.primary}
              />
              <Text className="text-text-primary font-semibold ml-2">Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-neutral-light-2 rounded-2xl py-4 flex-1 flex-row items-center justify-center"
              onPress={togglePause}
            >
              <Ionicons
                name={isPaused ? "play-outline" : "pause-outline"}
                size={20}
                color={colors.text.primary}
              />
              <Text className="text-text-primary font-semibold ml-2">
                {isPaused ? "Resume" : "Pause"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-primary rounded-2xl py-4 flex-1 flex-row items-center justify-center"
              onPress={() => setShowCompleteModal(true)}
            >
              <Ionicons
                name="checkmark"
                size={20}
                color={colors.text.secondary}
              />
              <Text className="text-secondary font-semibold ml-2">
                Complete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Complete Exercise Modal */}
      <Modal visible={showCompleteModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <Text className="text-xl font-bold text-text-primary mb-4 text-center">
              Complete Exercise
            </Text>
            <Text className="text-base text-text-secondary text-center mb-6 leading-6">
              Mark "{currentExercise?.exercise.name}" as complete? Your progress
              will be saved.
            </Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="bg-neutral-light-2 rounded-xl py-3 px-6 flex-1"
                onPress={() => setShowCompleteModal(false)}
              >
                <Text className="text-text-primary font-semibold text-center">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`bg-primary rounded-xl py-3 px-6 flex-1 ${
                  isCompletingExercise ? "opacity-75" : ""
                }`}
                onPress={completeExercise}
                disabled={isCompletingExercise}
              >
                {isCompletingExercise ? (
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator
                      size="small"
                      color={colors.text.secondary}
                    />
                    <Text className="text-secondary font-semibold ml-2">
                      Saving...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-secondary font-semibold text-center">
                    Complete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Skip Exercise Modal */}
      <Modal visible={showSkipModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <Text className="text-xl font-bold text-text-primary mb-4 text-center">
              Skip Exercise
            </Text>
            <Text className="text-base text-text-secondary text-center mb-6 leading-6">
              Skip "{currentExercise?.exercise.name}"? This exercise will be
              marked as incomplete.
            </Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="bg-neutral-light-2 rounded-xl py-3 px-6 flex-1"
                onPress={() => setShowSkipModal(false)}
              >
                <Text className="text-text-primary font-semibold text-center">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`bg-primary rounded-xl py-3 px-6 flex-1 ${
                  isSkippingExercise ? "opacity-75" : ""
                }`}
                onPress={skipCurrentExercise}
                disabled={isSkippingExercise}
              >
                {isSkippingExercise ? (
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator
                      size="small"
                      color={colors.text.primary}
                    />
                    <Text className="text-text-primary font-semibold ml-2">
                      Skipping...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-text-primary font-semibold text-center">
                    Skip
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rest Complete Modal */}
      <Modal visible={showRestCompleteModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <View className="items-center mb-4">
              <Ionicons name="timer" size={48} color={colors.brand.primary} />
            </View>
            <Text className="text-xl font-bold text-text-primary mb-4 text-center">
              Rest Complete!
            </Text>
            <Text className="text-base text-text-secondary text-center mb-6 leading-6">
              Your {currentExercise?.restTime}s rest is finished. What would you
              like to do next?
            </Text>

            {/* Show current progress */}
            {currentProgress && currentExercise && (
              <View className="bg-neutral-light-1 rounded-xl p-3 mb-6">
                <Text className="text-sm font-semibold text-text-primary mb-2 text-center">
                  Current Progress
                </Text>
                <View className="flex-row justify-center items-center space-x-4">
                  <View className="items-center">
                    <Text className="text-lg font-bold text-text-primary">
                      {currentProgress.sets?.length || 0}
                    </Text>
                    <Text className="text-xs text-text-muted">
                      of {currentExercise.sets || 3} sets
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View className="space-y-3">
              {/* Continue button - only show if more sets are needed */}
              {currentProgress &&
                currentExercise &&
                (currentProgress.sets?.length || 0) <
                  (currentExercise.sets || 3) && (
                  <TouchableOpacity
                    className="bg-primary rounded-xl py-3 mb-3 px-6"
                    onPress={() => {
                      setShowRestCompleteModal(false);
                      // Timer is already finished, user can continue with next set
                    }}
                  >
                    <Text className="text-secondary font-semibold text-center">
                      Continue Exercise
                    </Text>
                  </TouchableOpacity>
                )}

              {/* Complete exercise button */}
              <TouchableOpacity
                className="bg-neutral-light-2 rounded-xl py-3 px-6"
                onPress={() => {
                  setShowRestCompleteModal(false);
                  setShowCompleteModal(true);
                }}
              >
                <Text className="text-text-primary font-semibold text-center">
                  Complete Exercise
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
