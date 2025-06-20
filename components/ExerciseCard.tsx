import React from "react";
import { View, StyleSheet, TouchableOpacity, Image } from "react-native";
import Text from "./Text";
import Card from "./Card";
import {
  formatMuscleGroups,
  formatDifficulty,
  formatEquipment,
} from "../utils";
import { colors } from "../lib/theme";

interface Exercise {
  id: number;
  name: string;
  description: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: string;
  imageUrl?: string;
  instructions?: string;
}

interface ExerciseCardProps {
  exercise: Exercise;
  onPress?: (exercise: Exercise) => void;
  selected?: boolean;
  expanded?: boolean;
  onAddToWorkout?: (exercise: Exercise) => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  onPress,
  selected = false,
  expanded = false,
  onAddToWorkout,
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress(exercise);
    }
  };

  const handleAddToWorkout = () => {
    if (onAddToWorkout) {
      onAddToWorkout(exercise);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[styles.container, selected && styles.selectedContainer]}
    >
      <Card variant={selected ? "outlined" : "default"}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text variant="title">{exercise.name}</Text>
              <Text variant="bodySmall" color={colors.text.muted}>
                {formatMuscleGroups(exercise.muscleGroups)} •{" "}
                {formatDifficulty(exercise.difficulty)}
              </Text>
            </View>

            {exercise.imageUrl && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: exercise.imageUrl }}
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>
            )}
          </View>

          {expanded && (
            <View style={styles.expandedContent}>
              <Text
                variant="bodySmall"
                color={colors.text.secondary}
                style={styles.description}
              >
                {exercise.description}
              </Text>

              {exercise.instructions && (
                <View style={styles.section}>
                  <Text variant="subtitle" style={styles.sectionTitle}>
                    Instructions
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary}>
                    {exercise.instructions}
                  </Text>
                </View>
              )}

              <View style={styles.section}>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  Equipment
                </Text>
                <View style={styles.tags}>
                  {exercise.equipment.map((item, index) => (
                    <View key={index} style={styles.tag}>
                      <Text variant="caption">{formatEquipment(item)}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddToWorkout}
              >
                <Text
                  variant="bodySmall"
                  color={colors.background}
                  weight="semibold"
                >
                  Add to Workout
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  selectedContainer: {
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.neutral.light[1],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.light[2],
  },
  description: {
    marginBottom: 12,
    lineHeight: 20,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 6,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: colors.neutral.light[1],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 8,
  },
});

export default ExerciseCard;
