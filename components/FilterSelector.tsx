import React from "react";
import { colors } from "../lib/theme";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterSelectorProps {
  title: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export const FilterSelector: React.FC<FilterSelectorProps> = ({
  title,
  options,
  selectedValue,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              selectedValue === option.value && styles.selectedOption,
            ]}
            onPress={() => onSelect(option.value)}
          >
            <Text
              style={[
                styles.optionText,
                selectedValue === option.value && styles.selectedOptionText,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Common filter options
export const timeRangeOptions: FilterOption[] = [
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
];

export const groupByOptions: FilterOption[] = [
  { label: "Exercise", value: "exercise" },
  { label: "Day", value: "day" },
  { label: "Muscle Group", value: "muscle_group" },
];

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 8,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.neutral.light[1],
    borderWidth: 1,
    borderColor: colors.neutral.light[2],
  },
  selectedOption: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  optionText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.text.muted,
  },
  selectedOptionText: {
    color: colors.background,
  },
});
