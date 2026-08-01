import { Save } from "lucide-react";
import { CaptureButton } from "@ds";

/** Botão de salvar clipe — usa o Capture Button do Design System. Contrato inalterado. */
export function SaveClipButton({
  onClick,
  disabled,
  hotkey,
}: {
  onClick: () => void;
  disabled?: boolean;
  hotkey: string;
}) {
  return (
    <CaptureButton icon={Save} onClick={onClick} hotkey={hotkey} {...(disabled ? { disabled } : {})} />
  );
}
