import { useLocalSearchParams } from "expo-router";
import { MovementScreen } from "../components/MovementForm";

export default function MoveScreen() {
  const { sku } = useLocalSearchParams<{ sku?: string }>();
  return (
    <MovementScreen
      preSku={sku}
      mode={{
        title: "Move To Floor",
        kind: "OUTWARD",
        primaryLabel: "Save Outward",
        accent: "#7c3aed",
        verb: "Issued",
      }}
    />
  );
}
