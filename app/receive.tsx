import { useLocalSearchParams } from "expo-router";
import { MovementScreen } from "../components/MovementForm";

export default function ReceiveScreen() {
  const { sku } = useLocalSearchParams<{ sku?: string }>();
  return (
    <MovementScreen
      preSku={sku}
      mode={{
        title: "Receive inward",
        subtitle: "Add stock that just arrived at the warehouse.",
        kind: "INWARD",
        primaryLabel: "Save inward",
        accent: "#10b981",
        verb: "Added",
      }}
    />
  );
}
