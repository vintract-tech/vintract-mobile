import { useLocalSearchParams } from "expo-router";
import { MovementScreen } from "../components/MovementForm";

export default function ReceiveScreen() {
  const { sku, t } = useLocalSearchParams<{ sku?: string; t?: string }>();
  return (
    <MovementScreen
      // t busts the key so re-scanning the SAME label still re-resolves.
      key={t ?? "initial"}
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
