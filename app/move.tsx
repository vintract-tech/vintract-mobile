import { useLocalSearchParams } from "expo-router";
import { MovementScreen } from "../components/MovementForm";

export default function MoveScreen() {
  const { sku } = useLocalSearchParams<{ sku?: string }>();
  return (
    <MovementScreen
      preSku={sku}
      mode={{
        title: "Move to floor",
        subtitle: "Issue stock from store to production.",
        kind: "OUTWARD",
        primaryLabel: "Save outward",
        accent: "#f59e0b",
        verb: "Issued",
      }}
    />
  );
}
