import { useLocalSearchParams } from "expo-router";
import { MovementScreen } from "../components/MovementForm";

export default function ReceiveScreen() {
  const { sku } = useLocalSearchParams<{ sku?: string }>();
  return (
    <MovementScreen
      preSku={sku}
      mode={{
        title: "Receive Inward",
        kind: "INWARD",
        primaryLabel: "Save Inward",
        accent: "#7c3aed",
        verb: "Added",
      }}
    />
  );
}
