import { useLocalSearchParams } from "expo-router";
import { MovementScreen } from "../components/MovementForm";

export default function MoveScreen() {
  const { sku, t } = useLocalSearchParams<{ sku?: string; t?: string }>();
  return (
    <MovementScreen
      // t busts the key so re-scanning the SAME label still re-resolves.
      key={t ?? "initial"}
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
