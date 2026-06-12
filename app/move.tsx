import { useLocalSearchParams } from "expo-router";
import { MovementScreen } from "../components/MovementForm";

export default function MoveScreen() {
  const { sku } = useLocalSearchParams<{ sku?: string }>();
  return (
    <MovementScreen
      preSku={sku}
      mode={{
        title: "Move to floor",
        kind: "OUTWARD",
        primaryLabel: "Save outward",
        accent: "#7c3aed",
        verb: "Issued",
      }}
    />
  );
}
