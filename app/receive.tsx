import { useLocalSearchParams } from "expo-router";
import { MovementScreen } from "../components/MovementForm";

export default function ReceiveScreen() {
  const { sku } = useLocalSearchParams<{ sku?: string }>();
  return (
    <MovementScreen
      preSku={sku}
      mode={{
        title: "Receive inward",
        kind: "INWARD",
        primaryLabel: "Save inward",
        accent: "#7c3aed",
        verb: "Added",
      }}
    />
  );
}
