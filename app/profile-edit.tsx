import React, { useState, useEffect } from "react";
import { View, Text, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@contexts/AuthContext";
import { fetchUserProfile, updateUserProfile, Profile } from "@lib/profile";
import OnboardingForm, { FormData } from "@components/OnboardingForm";

// Import enums directly from OnboardingForm since they're defined there
enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
}

enum FitnessGoals {
  WEIGHT_LOSS = "weight_loss",
  MUSCLE_GAIN = "muscle_gain",
  STRENGTH = "strength",
  ENDURANCE = "endurance",
  FLEXIBILITY = "flexibility",
  GENERAL_FITNESS = "general_fitness",
  MOBILITY = "mobility",
  BALANCE = "balance",
  RECOVERY = "recovery",
}

enum PhysicalLimitations {
  KNEE_PAIN = "knee_pain",
  SHOULDER_PAIN = "shoulder_pain",
  LOWER_BACK_PAIN = "lower_back_pain",
  NECK_PAIN = "neck_pain",
  HIP_PAIN = "hip_pain",
  ANKLE_INSTABILITY = "ankle_instability",
  WRIST_PAIN = "wrist_pain",
  ELBOW_PAIN = "elbow_pain",
  ARTHRITIS = "arthritis",
  OSTEOPOROSIS = "osteoporosis",
  SCIATICA = "sciatica",
  LIMITED_RANGE_OF_MOTION = "limited_range_of_motion",
  POST_SURGERY_RECOVERY = "post_surgery_recovery",
  BALANCE_ISSUES = "balance_issues",
  CHRONIC_FATIGUE = "chronic_fatigue",
  BREATHING_ISSUES = "breathing_issues",
}

enum FitnessLevels {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
}

enum WorkoutEnvironments {
  HOME = "home",
  GYM = "gym",
  HYBRID = "hybrid",
}

enum AvailableEquipment {
  DUMBBELLS = "dumbbells",
  RESISTANCE_BANDS = "resistance_bands",
  MACHINES = "machines",
  BODYWEIGHT = "bodyweight",
  KETTLEBELLS = "kettlebells",
  MEDICINE_BALL = "medicine_ball",
  FOAM_ROLLER = "foam_roller",
  TREADMILL = "treadmill",
  BIKE = "bike",
  YOGA_MAT = "yoga_mat",
}

enum PreferredStyles {
  HIIT = "HIIT",
  STRENGTH = "strength",
  CARDIO = "cardio",
  REHAB = "rehab",
  CROSSFIT = "crossfit",
  FUNCTIONAL = "functional",
  PILATES = "pilates",
  YOGA = "yoga",
  BALANCE = "balance",
  MOBILITY = "mobility",
}

enum PreferredDays {
  MONDAY = "monday",
  TUESDAY = "tuesday",
  WEDNESDAY = "wednesday",
  THURSDAY = "thursday",
  FRIDAY = "friday",
  SATURDAY = "saturday",
  SUNDAY = "sunday",
}

enum IntensityLevels {
  LOW = "low",
  MODERATE = "moderate",
  HIGH = "high",
}

export default function ProfileEditScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load user profile data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const profileData = await fetchUserProfile();
        setProfile(profileData);
      } catch (error) {
        console.error("Error loading profile:", error);
        Alert.alert("Error", "Failed to load your profile data");
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      loadProfile();
    }
  }, [user?.id]);

  // Convert profile data to form data format
  const convertProfileToFormData = (profile: Profile): FormData => {
    // Handle intensity level conversion
    let intensityLevel = IntensityLevels.MODERATE;
    if (profile.intensityLevel) {
      if (typeof profile.intensityLevel === "number") {
        intensityLevel =
          profile.intensityLevel === 1
            ? IntensityLevels.LOW
            : profile.intensityLevel === 2
            ? IntensityLevels.MODERATE
            : IntensityLevels.HIGH;
      } else {
        // Handle string values
        switch (profile.intensityLevel.toLowerCase()) {
          case "low":
            intensityLevel = IntensityLevels.LOW;
            break;
          case "moderate":
            intensityLevel = IntensityLevels.MODERATE;
            break;
          case "high":
            intensityLevel = IntensityLevels.HIGH;
            break;
          default:
            intensityLevel = IntensityLevels.MODERATE;
        }
      }
    }

    // Handle environment - convert from string to enum if needed
    let environment = WorkoutEnvironments.HOME;
    if (profile.environment) {
      if (Array.isArray(profile.environment)) {
        environment = profile.environment[0] as WorkoutEnvironments;
      } else {
        // Map string values to enum
        switch (profile.environment.toLowerCase()) {
          case "home":
            environment = WorkoutEnvironments.HOME;
            break;
          case "gym":
            environment = WorkoutEnvironments.GYM;
            break;
          case "hybrid":
            environment = WorkoutEnvironments.HYBRID;
            break;
          default:
            environment = WorkoutEnvironments.HOME;
        }
      }
    }

    // Handle gender conversion
    let gender = Gender.MALE;
    if (profile.gender) {
      switch (profile.gender.toLowerCase()) {
        case "male":
          gender = Gender.MALE;
          break;
        case "female":
          gender = Gender.FEMALE;
          break;
        case "other":
          gender = Gender.OTHER;
          break;
        default:
          gender = Gender.MALE;
      }
    }

    // Handle fitness level conversion
    let fitnessLevel = FitnessLevels.BEGINNER;
    if (profile.fitnessLevel) {
      switch (profile.fitnessLevel.toLowerCase()) {
        case "beginner":
          fitnessLevel = FitnessLevels.BEGINNER;
          break;
        case "intermediate":
          fitnessLevel = FitnessLevels.INTERMEDIATE;
          break;
        case "advanced":
          fitnessLevel = FitnessLevels.ADVANCED;
          break;
        default:
          fitnessLevel = FitnessLevels.BEGINNER;
      }
    }

    // Convert string arrays to enum arrays
    const convertStringArrayToEnum = <T extends string>(
      arr: string[] | undefined,
      enumObj: Record<string, T>
    ): T[] => {
      if (!arr) return [];
      return arr
        .map((item) => {
          const enumKey = Object.keys(enumObj).find(
            (key) => enumObj[key].toLowerCase() === item.toLowerCase()
          );
          return enumKey ? enumObj[enumKey] : null;
        })
        .filter((item): item is T => item !== null);
    };

    return {
      email: user?.email || "",
      age: profile.age || 25,
      height: profile.height || 170,
      weight: profile.weight || 70,
      gender: gender,
      goals: convertStringArrayToEnum(profile.goals, FitnessGoals),
      limitations: convertStringArrayToEnum(
        profile.limitations,
        PhysicalLimitations
      ),
      fitnessLevel: fitnessLevel,
      environment: environment,
      equipment: convertStringArrayToEnum(
        profile.equipment,
        AvailableEquipment
      ),
      preferredStyles: convertStringArrayToEnum(
        profile.preferredStyles,
        PreferredStyles
      ),
      availableDays: convertStringArrayToEnum(
        profile.availableDays,
        PreferredDays
      ),
      workoutDuration: profile.workoutDuration || 30,
      intensityLevel: intensityLevel,
      medicalNotes: profile.medicalNotes || "",
    };
  };

  // Handle profile update
  const handleUpdateProfile = async (formData: FormData) => {
    try {
      setSaving(true);

      // Convert form data to profile update format - matching the working onboarding format
      const profileData = {
        age: formData.age,
        height: formData.height,
        weight: formData.weight,
        gender: formData.gender.toString(),
        goals: formData.goals.map((g: FitnessGoals) => g.toString()),
        limitations:
          formData.limitations?.map((l: PhysicalLimitations) => l.toString()) ||
          [],
        fitnessLevel: formData.fitnessLevel.toString(),
        environment: formData.environment.toString(),
        equipment:
          formData.equipment?.map((e: AvailableEquipment) => e.toString()) ||
          [],
        workoutStyles: formData.preferredStyles.map((s: PreferredStyles) =>
          s.toString()
        ),
        availableDays: formData.availableDays.map((d: PreferredDays) =>
          d.toString()
        ),
        workoutDuration: formData.workoutDuration,
        intensityLevel: formData.intensityLevel.toString(),
        medicalNotes: formData.medicalNotes,
      };

      console.log("Sending profile data:", profileData);

      // Update the profile
      const updatedProfile = await updateUserProfile(profileData as any);

      if (updatedProfile) {
        Alert.alert("Success", "Your profile has been updated successfully!", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Discard Changes?",
      "Are you sure you want to discard your changes?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => router.back(),
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-light-1 justify-center items-center">
        <Text className="text-text-muted">Loading your profile...</Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-light-1 justify-center items-center">
        <Text className="text-text-muted">Failed to load profile</Text>
        <TouchableOpacity
          className="mt-4 bg-primary px-6 py-3 rounded-xl"
          onPress={() => router.back()}
        >
          <Text className="text-secondary font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-light-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-neutral-light-2">
        <TouchableOpacity onPress={handleCancel}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-text-primary">
          Edit Profile
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Onboarding Form */}
      <OnboardingForm
        title="Update Your Profile"
        initialData={convertProfileToFormData(profile)}
        onSubmit={handleUpdateProfile}
        onCancel={handleCancel}
        isLoading={saving}
        submitButtonText="Save Changes"
        showNavigation={true}
      />
    </SafeAreaView>
  );
}
