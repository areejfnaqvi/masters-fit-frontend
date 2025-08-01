import { useState, useEffect, useRef } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import {
  FormData,
  OnboardingFormProps,
  ArrayFields,
  ArrayValue,
} from "@/types/components";
import {
  OnboardingStep,
  Gender,
  FitnessLevels,
  IntensityLevels,
  WorkoutEnvironments,
} from "@/types/enums";
import { validateStep } from "./onboarding/utils/validation";
import { getEquipmentForEnvironment } from "./onboarding/utils/equipmentLogic";
import OnboardingHeader from "./onboarding/ui/OnboardingHeader";
import NavigationButtons from "./onboarding/ui/NavigationButtons";
import PersonalInfoStep from "./onboarding/steps/PersonalInfoStep";
import FitnessGoalsStep from "./onboarding/steps/FitnessGoalsStep";
import PhysicalLimitationsStep from "./onboarding/steps/PhysicalLimitationsStep";
import FitnessLevelStep from "./onboarding/steps/FitnessLevelStep";
import WorkoutEnvironmentStep from "./onboarding/steps/WorkoutEnvironmentStep";
import WorkoutStyleStep from "./onboarding/steps/WorkoutStyleStep";

// Re-export types for backward compatibility
export type {
  FormData,
  OnboardingFormProps,
  ArrayFields,
  ArrayValue,
} from "@/types/components";

export default function OnboardingForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  showNavigation = true,
  title,
  submitButtonText = "Generate My Plan",
}: OnboardingFormProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    OnboardingStep.PERSONAL_INFO
  );

  // Initialize form data with default values
  const [formData, setFormData] = useState<FormData>({
    email: "",
    age: 40,
    height: 170,
    weight: 150,
    gender: Gender.MALE,
    goals: [],
    limitations: [],
    fitnessLevel: FitnessLevels.BEGINNER,
    equipment: [],
    otherEquipment: "",
    preferredStyles: [],
    availableDays: [],
    workoutDuration: 30,
    intensityLevel: IntensityLevels.MODERATE,
    medicalNotes: "",
    ...initialData,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentStep]);

  // Helper function for type-safe form updates
  const handleChange = (
    field: keyof FormData,
    value: FormData[keyof FormData]
  ) => {
    const updates: Partial<FormData> = { [field]: value };

    // Auto-assign equipment based on environment selection
    if (field === "environment") {
      updates.equipment = getEquipmentForEnvironment(
        value as WorkoutEnvironments
      );
    }

    setFormData((prev) => ({
      ...prev,
      ...updates,
    }));

    // Clear error for this field
    if (errors[field as string]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  // Helper function for multi-select toggles
  const handleMultiSelectToggle = (field: ArrayFields, value: ArrayValue) => {
    setFormData((prev) => {
      const currentArray = prev[field] as ArrayValue[];
      const isSelected = currentArray.includes(value);

      return {
        ...prev,
        [field]: isSelected
          ? currentArray.filter((item) => item !== value)
          : [...currentArray, value],
      };
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleNext = () => {
    const validation = validateStep(currentStep, formData);
    if (validation.isValid) {
      setCurrentStep((prev) => prev + 1);
      setErrors({});
    } else {
      setErrors(validation.errors);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
    setErrors({});
  };

  const handleSubmit = () => {
    const validation = validateStep(currentStep, formData);
    if (validation.isValid) {
      onSubmit(formData);
    } else {
      setErrors(validation.errors);
    }
  };

  // Render the current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case OnboardingStep.PERSONAL_INFO:
        return (
          <PersonalInfoStep
            formData={formData}
            errors={errors}
            onFieldChange={handleChange}
          />
        );
      case OnboardingStep.FITNESS_GOALS:
        return (
          <FitnessGoalsStep
            formData={formData}
            onToggle={handleMultiSelectToggle}
          />
        );
      case OnboardingStep.PHYSICAL_LIMITATIONS:
        return (
          <PhysicalLimitationsStep
            formData={formData}
            onToggle={handleMultiSelectToggle}
            onFieldChange={handleChange}
            scrollViewRef={scrollRef}
          />
        );
      case OnboardingStep.FITNESS_LEVEL:
        return (
          <FitnessLevelStep
            formData={formData}
            errors={errors}
            onFieldChange={handleChange}
            onToggle={handleMultiSelectToggle}
          />
        );
      case OnboardingStep.WORKOUT_ENVIRONMENT:
        return (
          <WorkoutEnvironmentStep
            formData={formData}
            errors={errors}
            onFieldChange={handleChange}
            onToggle={handleMultiSelectToggle}
          />
        );
      case OnboardingStep.WORKOUT_STYLE:
        return (
          <WorkoutStyleStep
            formData={formData}
            onToggle={handleMultiSelectToggle}
          />
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with step indicator */}
        <OnboardingHeader currentStep={currentStep} totalSteps={6} />

        {/* Step Content */}
        {renderStepContent()}
      </ScrollView>

      {/* Navigation Buttons */}
      <NavigationButtons
        currentStep={currentStep}
        isLoading={isLoading}
        submitButtonText={submitButtonText}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSubmit={handleSubmit}
      />
    </KeyboardAvoidingView>
  );
}
